-- 009: Stripe Webhook イベント処理履歴テーブル
--
-- WHY: Stripe Webhook は同一イベントが重複送信されることがあり、
-- リプレイ攻撃や誤った重複処理を防ぐため、event.id ごとの処理履歴を
-- DB に記録し、2回目以降は即座に 200 OK を返す。
-- checkout.session.completed は orders.stripe_session_id の unique 制約で
-- ガードされているが、invoice.payment_succeeded 等は重複レコードが
-- 作成されるリスクがあるため、イベント単位の重複制御を導入する。

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  processed_at timestamptz not null default now()
);

-- インデックス（重複チェックの高速化）
create index if not exists idx_stripe_webhook_events_event_id
  on public.stripe_webhook_events (event_id);

-- RLS: 認証ユーザーは参照のみ。挿入・更新は service_role（Webhook 側）のみ。
alter table public.stripe_webhook_events enable row level security;

create policy "stripe_webhook_events_select_auth"
  on public.stripe_webhook_events
  for select
  to authenticated
  using (true);

create policy "stripe_webhook_events_insert_service_role"
  on public.stripe_webhook_events
  for insert
  to authenticated
  with check (false);
