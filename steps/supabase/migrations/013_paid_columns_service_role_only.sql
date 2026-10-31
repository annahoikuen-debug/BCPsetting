-- 013: 課金関連カラムを service_role 専用に + orders 更新ポリシーの削除
--
-- 背景:
-- 007 のトリガーは「role <> 'owner' のメンバー」だけを拒否していたが、本製品は
-- 会社あたりオーナー 1 人しか存在しないため、実際に決済ゲートを回避できる人物
-- （オーナー本人）には何も効いていなかった。オーナーは anon key + 自 JWT で
-- purchased_at / subscription_status / document_version / stripe_* を直接
-- 書き換え可能だった。
--
-- 対策1: 認証コンテキスト（auth.uid() IS NOT NULL）を持つ更新は、ロールに関係なく
--   課金関連カラムの変更を全面拒否する。service_role（auth.uid() = NULL）のみ許可。
--   正常系の書き込みはすべてサーバー側（Webhook / service_role RPC）で行われる。
--
-- 対策2: orders_update_own_company ポリシーを削除する。orders は金額・ステータスを
--   含む財務レコードであり、ユーザーによる status（pending→paid 等）・amount の
--   改ざんを許すべきでない。挿入は冪等記録のために許可済み（orders_insert_own_company）。
--   更新は Webhook（service_role）のみが行う。
--
-- 影響確認:
--   - upsertBcpDraft（Server Action）: companies の name/address/industry/
--     employee_scale/updated_at のみ更新 → 対象外
--   - generateAndStoreDocuments: document_version は service_role RPC
--     （011 の increment_document_version、admin クライアント経由 = auth.uid() NULL）→ 許可
--   - Webhook: createAdminClient（service_role）→ 許可
--
-- 注意: auth.uid() はリクエストの JWT から導出されるため、SECURITY DEFINER 関数内
-- でも呼び出し元の JWT が参照される。service_role キーには JWT claims が無い
-- （auth.uid() が NULL を返す）ため、本トリガーは service_role 経由の更新を許可する。

create or replace function public.prevent_authenticated_paid_column_updates()
returns trigger as $$
begin
  -- 認証コンテキストがない場合（service_role 等）は許可
  if auth.uid() is null then
    return new;
  end if;

  -- 認証付きリクエスト（Server Action のユーザークライアント含む）からの
  -- 課金関連カラム変更は全面拒否
  if (new.purchased_at is distinct from old.purchased_at)
     or (new.subscription_status is distinct from old.subscription_status)
     or (new.document_version is distinct from old.document_version)
     or (new.stripe_customer_id is distinct from old.stripe_customer_id)
     or (new.stripe_subscription_id is distinct from old.stripe_subscription_id)
     or (new.subscription_plan is distinct from old.subscription_plan)
     or (new.subscription_current_period_end is distinct from old.subscription_current_period_end)
     or (new.subscription_cancel_at_period_end is distinct from old.subscription_cancel_at_period_end) then
    raise exception '課金関連カラムの更新は許可されていません';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists companies_prevent_non_owner_paid_updates on public.companies;

create trigger companies_prevent_authenticated_paid_updates
  before update on public.companies
  for each row
  execute function public.prevent_authenticated_paid_column_updates();

-- 旧関数が不要になるため削除（存在すれば）
drop function if exists public.prevent_non_owner_paid_column_updates();

-- orders はユーザーによる更新を禁止（財務レコードの改ざん防止）
drop policy if exists "orders_update_own_company" on public.orders;
