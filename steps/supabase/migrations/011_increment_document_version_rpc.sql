-- 011: document_version を原子的にインクリメントする RPC
--
-- WHY: processPayment / サブスク発行フローでは「現在値を読む → +1 して書き戻す」
-- をクライアント側で行っており、同時実行で同じバージョン番号が採番される競合が
-- あった。PostgreSQL の UPDATE ... RETURNING を使えば読み取りと加算を 1 文で
-- 原子的に実行できる。
--
-- セキュリティ: SECURITY DEFINER（オーナー権限で実行、RLS バイパス）だが、
-- companies の課金関連カラム保護トリガー（007）は auth.uid() ベースで動くため、
-- 認証付き JWT で REST から直接呼び出した場合はトリガーが拒否する。
-- アプリケーションからは service_role クライアント経由でのみ呼び出すこと。

create or replace function public.increment_document_version(p_company_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_version int;
begin
  update public.companies
    set document_version = coalesce(document_version, 0) + 1
    where id = p_company_id
    returning document_version into new_version;

  if new_version is null then
    raise exception '会社が見つかりません: %', p_company_id;
  end if;

  return new_version;
end;
$$;
