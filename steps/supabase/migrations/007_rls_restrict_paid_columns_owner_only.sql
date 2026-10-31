-- 007: RLS companies 更新時、課金関連カラムはオーナーのみ変更可能にする
--
-- WHY: PostgreSQL RLS ポリシーは行レベル制御のみでカラムレベル制限ができないため、
-- トリガーで非オーナー（role <> 'owner'）の purchased_at / subscription_status /
-- document_version / stripe_* カラム更新を拒否する。これにより同社メンバーによる
-- 決済ゲート回避を DB レベルで防止する。
-- service_role（Webhook等）は auth.uid() が NULL となるため、制限対象外とする。

create or replace function public.prevent_non_owner_paid_column_updates()
returns trigger as $$
declare
  caller_role text;
begin
  -- 認証コンテキストがない場合（service_role 等）は RLS バイパス対象として許可
  if auth.uid() is null then
    return new;
  end if;

  select p.role into caller_role
  from public.profiles p
  where p.id = auth.uid();

  -- プロフィールが見つからない場合は更新を拒否（RLS でも弾かれるが二重ガード）
  if caller_role is null then
    raise exception 'プロフィールが見つかりません';
  end if;

  -- オーナー以外は課金関連カラムの変更を禁止
  if caller_role <> 'owner' then
    if (new.purchased_at is distinct from old.purchased_at)
       or (new.subscription_status is distinct from old.subscription_status)
       or (new.document_version is distinct from old.document_version)
       or (new.stripe_customer_id is distinct from old.stripe_customer_id)
       or (new.stripe_subscription_id is distinct from old.stripe_subscription_id)
       or (new.subscription_plan is distinct from old.subscription_plan)
       or (new.subscription_current_period_end is distinct from old.subscription_current_period_end)
       or (new.subscription_cancel_at_period_end is distinct from old.subscription_cancel_at_period_end) then
      raise exception '課金関連カラムの更新はオーナーのみ可能です';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger companies_prevent_non_owner_paid_updates
  before update on public.companies
  for each row
  execute function public.prevent_non_owner_paid_column_updates();
