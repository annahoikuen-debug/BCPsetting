-- 010: companies 挿入ポリシーを厳格化
--
-- WHY: 現状の companies_insert_auth は with check (true) で、認証済みユーザーなら
-- 誰でも companies テーブルに任意の会社レコードを挿入できてしまう。
-- プロファイルと company_id の整合性が取れない挿入を防ぎ、他社データへの
-- 不正アクセス経路を断つ。
-- 実際の会社作成は signup / ensureProfile サーバーアクション（service_role）で
-- 行うため、認証ユーザー（anon）からの直接挿入は制限して問題ない。

drop policy if exists "companies_insert_auth" on public.companies;

create policy "companies_insert_own_profile"
  on public.companies
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = companies.id
    )
  );
