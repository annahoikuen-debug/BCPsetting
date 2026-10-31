-- 006: generated_documents に重複発行防止のユニーク制約を追加
--
-- WHY: 同一会社・同一ドキュメント種別・同一バージョンの行が重複挿入される
-- と、ZIP ダウンロードや再ダウンロードで重複ファイルが返ってしまう。
-- (company_id, doc_type, version) のユニーク制約で DB レベルで防止する。

create unique index if not exists idx_generated_documents_company_doc_type_version
  on public.generated_documents (company_id, doc_type, version);
