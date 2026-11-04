-- 015: プライベート Storage バケット bcp-documents を作成
--
-- WHY: PDF ドキュメント（bcp_full / action_manual / pocket_card）は
-- service_role クライアント経由でこのバケットにアップロードされ、
-- ダウンロード時は短時間の署名付き URL で配布される。
--
-- セキュリティ方針:
--   - public = false（非公開バケット）
--   - allowed_mime_types を application/pdf に制限
--   - file_size_limit を 10MB に制限（生成 PDF は 1MB 未満が目安）
--   - ユーザー側の Storage ポリシーは作成しない
--     （アクセスはすべて service_role + 署名付き URL 経由のため、
--      ポリシー無し = anon/authenticated は直接アクセス不可）
--
-- 注意: Storage バケットは storage スキーマの行として管理されるため、
-- SQL での作成はダッシュボード操作と等価。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bcp-documents',
  'bcp-documents',
  false,
  10485760, -- 10MB
  array['application/pdf']
)
on conflict (id) do nothing;
