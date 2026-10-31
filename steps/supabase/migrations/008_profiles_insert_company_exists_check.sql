-- 008: profiles 挿入ポリシーに会社存在チェックを追加
--
-- WHY: profiles_insert_own は id = auth.uid() のみチェックし、company_id の存在を
-- 検証していない。任意の company_id を指定して他社のプロファイルとして参加
-- でき、他社データにアクセス可能になる。
-- 対策: 挿入時に company_id が companies テーブルに存在することをチェックする。
-- 実際のプロファイル作成は signup / ensureProfile サーバーアクション（service_role）
-- で行うため、ユーザー直接挿入は最小限の検証のみに留める。

drop policy if exists "profiles_insert_own" on public.profiles;

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (
    id = auth.uid()
    and exists (
      select 1
      from public.companies c
      where c.id = profiles.company_id
    )
  );
