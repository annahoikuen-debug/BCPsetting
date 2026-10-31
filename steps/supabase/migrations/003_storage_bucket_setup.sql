-- 003: Supabase Storage バケット bcp-documents のセットアップ
--
-- Supabase Storage のバケットは SQL ではなく Supabase CLI / ダッシュボード / API で作成します。
-- このマイグレーションは、バケット作成後の権限設定と、ドキュメント管理のための
-- 補助処理を記録するものです。
--
-- 【手動で実行する必要がある操作】
-- 1. Supabase CLI でプライベートバケットを作成:
--    $ supabase storage create bcp-documents --private
--
-- 2. または Supabase ダッシュボードから:
--    Storage → Buckets → "Create Bucket" → 名前: bcp-documents → 公開: いいえ
--
-- 3. RLS ポリシーは bcp-documents バケットに対して、以下を設定する必要があります（ダッシュボードまたは API で）:
--    - 認証ユーザーは自社のフォルダ（{companyId}/）のみアップロード・ダウンロード可能
--    - サービスロールは全アクセス許可（サーバー側からの一括操作用）
--
-- 【バケット構成想定】
-- bcp-documents/
--   └── {companyId}/
--       ├── bcp_full_{version}.pdf
--       ├── action_manual_{version}.pdf
--       └── pocket_card_{version}.pdf

-- bcp-documents バケットへのアクセスポリシーは Supabase Storage 側で個別に設定してください。
-- このファイルはドキュメントおよびセットアップ手順の記録として保持します。

-- 補助：companies テーブルに document_version カラムを追加（ドキュメントバージョン管理用）
alter table public.companies
  add column if not exists document_version int default 0;

-- インデックス
create index if not exists idx_companies_document_version
  on public.companies (document_version);
