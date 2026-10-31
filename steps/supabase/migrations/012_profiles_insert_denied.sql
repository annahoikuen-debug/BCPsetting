-- 012: profiles への直接 INSERT を全面拒否
--
-- WHY: 008 では「id = auth.uid() かつ company_id が存在」のみチェックしており、
-- 認証済みユーザーが任意の既存会社の company_id を指定して profiles を
-- 直接 INSERT できた。これにより他社のメンバーとして RLS の select 許可を
-- 得られ、bcp_inputs / orders / generated_documents 等の他社データに
-- アクセス可能になる（クロステナントアクセス）。
--
-- 対策: 認証ユーザーからの profiles 挿入は全面拒否とする。
-- プロファイルの作成は signup / ensureProfile サーバーアクション
-- （service_role クライアント、RLS バイパス）経由でのみ行われるため、
-- 正常系のフローには影響しない。
--
-- 注意: RLS では「ポリシーが1つも無い操作」もデフォルトで拒否されるが、
-- 意図を明示するために with check (false) のポリシーを置く。

drop policy if exists "profiles_insert_own" on public.profiles;

create policy "profiles_insert_denied_for_authenticated"
  on public.profiles
  for insert
  to authenticated
  with check (false);
