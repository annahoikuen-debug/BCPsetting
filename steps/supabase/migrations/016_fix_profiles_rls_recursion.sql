-- 016: profiles RLS ポリシーの無限再帰バグを修正
--
-- WHY: 001 で作成した profiles_select_own_company / profiles_update_own_company は、
-- profiles テーブル自身へのポリシー内で profiles を再帰クエリしているため、
-- PostgreSQL が「infinite recursion detected in policy (42P17)」を返し、
-- 認証済みユーザーによる profiles の SELECT / UPDATE がすべて失敗する。
-- 結果として ensureProfile が companyId を返せず、ウィザードの保存・
-- ダッシュボード表示など全下流機能が動作しない。
--
-- 対策: security definer のヘルパー関数でメンバーシップ判定を行い、
-- ポリシーから profiles の直接クエリをなくす。

create or replace function public.has_company_membership(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and company_id = target_company_id
  )
$$;

drop policy if exists "profiles_select_own_company" on public.profiles;

create policy "profiles_select_own_company"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or public.has_company_membership(company_id)
  );

drop policy if exists "profiles_update_own_company" on public.profiles;

create policy "profiles_update_own_company"
  on public.profiles
  for update
  to authenticated
  using (
    id = auth.uid()
    or public.has_company_membership(company_id)
  )
  with check (
    id = auth.uid()
    or public.has_company_membership(company_id)
  );
