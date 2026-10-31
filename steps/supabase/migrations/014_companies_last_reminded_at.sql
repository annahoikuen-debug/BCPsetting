-- 014: 年次リマインドの送信履歴カラムを追加
--
-- WHY: /api/cron/remind-bcp-update は「最終更新から 330 日以上経過」した会社を
-- 毎回抽出しており、送信履歴がなかった。cron が頻繁に実行されると同一会社に
-- 繰り返しメールが送信される（スパム化）。
-- last_reminded_at を記録し、「updated_at が last_reminded_at より新しい場合のみ
-- 再リマインド」することで、同一データに対するリマインドは 1 回だけになる。

alter table public.companies
  add column if not exists last_reminded_at timestamptz;

-- インデックス（cron の未リマインド抽出用）
create index if not exists idx_companies_last_reminded_at
  on public.companies (last_reminded_at)
  where last_reminded_at is not null;
