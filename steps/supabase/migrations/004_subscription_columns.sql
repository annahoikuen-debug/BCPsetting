-- 004: サブスクリプション関連カラムを companies テーブルに追加
-- Stripe Billing の定期課金情報を管理する。

-- Stripe Customer ID
alter table public.companies
  add column if not exists stripe_customer_id text;

-- Stripe Subscription ID
alter table public.companies
  add column if not exists stripe_subscription_id text;

-- サブスクリプションステータス: active, past_due, canceled, unpaid, incomplete, incomplete_expired, trialing
alter table public.companies
  add column if not exists subscription_status text;

-- サブスクリプションプラン: monthly, yearly, null
alter table public.companies
  add column if not exists subscription_plan text;

-- 現在の課金期間終了日
alter table public.companies
  add column if not exists subscription_current_period_end timestamptz;

-- 期間終了時に解約するかどうか
alter table public.companies
  add column if not exists subscription_cancel_at_period_end boolean default false;

-- インデックス追加
create index if not exists idx_companies_stripe_customer_id
  on public.companies (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists idx_companies_stripe_subscription_id
  on public.companies (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists idx_companies_subscription_status
  on public.companies (subscription_status)
  where subscription_status is not null;

-- RLS ポリシーは既存の companies_select_own / companies_update_own でカバー済み。
-- サブスクリプション関連カラムの更新は service_role（Webhook 側）で行うため、
-- 認証ユーザーからの直接更新は既存のポリシーで制限される。

-- コメント（ドキュメント目的）
comment on column public.companies.stripe_customer_id is 'Stripe カスタマー ID';
comment on column public.companies.stripe_subscription_id is 'Stripe サブスクリプション ID';
comment on column public.companies.subscription_status is 'サブスクリプションステータス (active, past_due, canceled, unpaid, incomplete, incomplete_expired, trialing)';
comment on column public.companies.subscription_plan is 'サブスクリプションプラン (monthly, yearly)';
comment on column public.companies.subscription_current_period_end is '現在の課金期間終了日';
comment on column public.companies.subscription_cancel_at_period_end is '期間終了時に解約するかどうか';
