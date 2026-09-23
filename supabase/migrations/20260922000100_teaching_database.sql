-- Training Camp: run this whole file once in Supabase SQL Editor.
-- Requires Supabase Auth (auth.users, auth.uid(), authenticated and anon roles).
-- For a new schema: existing tables with these names cause a rollback, not an overwrite.
begin;

-- 1. Classes owned by a teacher. Monetary values are in VND.
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  salary_per_hour numeric(14,2) not null check (salary_per_hour between 0 and 999999999999.99),
  default_duration_hours numeric(6,3) not null default 1.5
    check (default_duration_hours > 0 and default_duration_hours <= 24),
  note text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

-- 2. Completed teaching sessions. Store the actual amount so later price
-- changes on a class never recalculate historical income.
create table public.teaching_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid not null,
  session_date date not null,
  start_time time,
  end_time time,
  session_hours numeric(6,3) not null check (session_hours > 0 and session_hours <= 24),
  session_amount numeric(14,2) not null check (session_amount between 0 and 999999999999.99),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The class must belong to the same account. Delete sessions explicitly
  -- or archive the class instead of silently losing financial history.
  foreign key (user_id, class_id) references public.classes(user_id, id),
  check ((start_time is null) = (end_time is null)),
  -- Overnight sessions are valid; end_time may be earlier than start_time.
  unique nulls not distinct (user_id, class_id, session_date, start_time)
);

-- 3. Salary actually received. A payment may cover several classes,
-- so it is linked to the teacher rather than to one specific class.
create table public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  payment_date date not null,
  amount numeric(14,2) not null check (amount > 0 and amount <= 999999999999.99),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Optional recurring weekly schedule: one per class, matching the app.
create table public.recurring_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, class_id) references public.classes(user_id, id) on delete cascade,
  unique (user_id, class_id),
  unique (user_id, id)
);

-- 5. Dates intentionally skipped from a recurring schedule.
create table public.recurring_schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  schedule_id uuid not null,
  exception_date date not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, schedule_id) references public.recurring_schedules(user_id, id) on delete cascade,
  unique (user_id, schedule_id, exception_date)
);

-- Monthly summaries and history lookups. Composite UNIQUE constraints above
-- already index ownership and foreign-key lookups for the other tables.
create index teaching_sessions_user_date_idx on public.teaching_sessions(user_id, session_date);
create index salary_payments_user_date_idx on public.salary_payments(user_id, payment_date);

-- Automatic updated_at, kept outside the API-exposed public schema.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create function app_private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function app_private.set_updated_at() from public, anon, authenticated;

-- All five tables share the same owner-only access rules.
-- USING protects existing rows; WITH CHECK also prevents changing user_id
-- or inserting records under another teacher's account.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'classes', 'teaching_sessions', 'salary_payments',
    'recurring_schedules', 'recurring_schedule_exceptions'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);

    execute format(
      'create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name);
    execute format(
      'create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name);
    execute format(
      'create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
    execute format(
      'create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name);

    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function app_private.set_updated_at()', table_name);
  end loop;
end;
$$;

commit;
