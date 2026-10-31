-- 002: companies テーブルに購入済みフラグ (purchased_at) を追加
-- Stripe 決済完了時に、その企業がドキュメント出力権限を購入済みかを記録する。

alter table public.companies
  add column if not exists purchased_at timestamptz;

-- インデックス追加（購入済み企業の高速フィルタ用）
create index if not exists idx_companies_purchased_at
  on public.companies (purchased_at)
  where purchased_at is not null;

-- RLS ポリシーは既存の companies_select_own / companies_update_own でカバー済み。
-- purchased_at の更新は service_role（Webhook 側）で行うため、
-- 認証ユーザーからの直接更新は既存のポリシーで制限される。
