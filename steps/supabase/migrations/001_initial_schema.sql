-- FastBCP 初期スキーマ
-- Supabase CLI: supabase db push または supabase migration new で適用

-- ---------------------------------------------------------------------------
-- 拡張機能
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- companies: 企業マスタ
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text not null,
  employee_scale text not null,
  postal_code text,
  address text,
  phone text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles: ユーザープロファイル（Supabase Auth と 1:1）
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text,
  role text not null default 'viewer'
    check (role in ('owner', 'editor', 'viewer')),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- bcp_inputs: BCP 策定入力データ（会社あたり1レコード）
-- ---------------------------------------------------------------------------
create table public.bcp_inputs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  step_status int not null default 1,
  policy jsonb,
  risk_assessment jsonb,
  core_business jsonb,
  emergency_contacts jsonb,
  measures_and_finance jsonb,
  is_completed boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- generated_documents: 生成ドキュメント履歴
-- ---------------------------------------------------------------------------
create table public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  doc_type text not null
    check (doc_type in ('bcp_full', 'action_manual', 'pocket_card')),
  file_url text not null,
  version int not null default 1,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- orders: Stripe 連携注文
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  stripe_session_id text not null unique,
  plan_type text not null
    check (plan_type in ('one_time', 'subscription')),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed')),
  amount int not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at 自動更新トリガー
-- ---------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger companies_handle_updated_at
  before update on public.companies
  for each row execute procedure public.handle_updated_at();

create trigger profiles_handle_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger bcp_inputs_handle_updated_at
  before update on public.bcp_inputs
  for each row execute procedure public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security (RLS)
-- ---------------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.bcp_inputs enable row level security;
alter table public.generated_documents enable row level security;
alter table public.orders enable row level security;

-- ---------------------------------------------------------------------------
-- companies: 自社のみ参照・更新・削除（挿入は認証済みユーザー許可）
-- ---------------------------------------------------------------------------
create policy "companies_select_own"
  on public.companies
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = companies.id
    )
  );

create policy "companies_insert_auth"
  on public.companies
  for insert
  to authenticated
  with check (true);

create policy "companies_update_own"
  on public.companies
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = companies.id
    )
  );

create policy "companies_delete_own"
  on public.companies
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = companies.id
    )
  );

-- ---------------------------------------------------------------------------
-- profiles: 同社メンバーのプロファイルを参照・更新（自分自身のレコードも含む）
-- ---------------------------------------------------------------------------
create policy "profiles_select_own_company"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = profiles.company_id
    )
  );

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles_update_own_company"
  on public.profiles
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = profiles.company_id
    )
  );

create policy "profiles_delete_own"
  on public.profiles
  for delete
  to authenticated
  using (id = auth.uid());

-- ---------------------------------------------------------------------------
-- bcp_inputs: 自社の BCP 入力データのみ参照・更新
-- ---------------------------------------------------------------------------
create policy "bcp_inputs_select_own_company"
  on public.bcp_inputs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = bcp_inputs.company_id
    )
  );

create policy "bcp_inputs_insert_own_company"
  on public.bcp_inputs
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = bcp_inputs.company_id
    )
  );

create policy "bcp_inputs_update_own_company"
  on public.bcp_inputs
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = bcp_inputs.company_id
    )
  );

create policy "bcp_inputs_delete_own_company"
  on public.bcp_inputs
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = bcp_inputs.company_id
    )
  );

-- ---------------------------------------------------------------------------
-- generated_documents: 自社の生成ドキュメントのみ参照・作成
-- ---------------------------------------------------------------------------
create policy "generated_documents_select_own_company"
  on public.generated_documents
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = generated_documents.company_id
    )
  );

create policy "generated_documents_insert_own_company"
  on public.generated_documents
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = generated_documents.company_id
    )
  );

create policy "generated_documents_delete_own_company"
  on public.generated_documents
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = generated_documents.company_id
    )
  );

-- ---------------------------------------------------------------------------
-- orders: 自社の注文のみ参照・作成
-- ---------------------------------------------------------------------------
create policy "orders_select_own_company"
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = orders.company_id
    )
  );

create policy "orders_insert_own_company"
  on public.orders
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = orders.company_id
    )
  );

create policy "orders_update_own_company"
  on public.orders
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = orders.company_id
    )
  );
