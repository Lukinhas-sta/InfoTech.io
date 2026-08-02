create extension if not exists pgcrypto;

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  protocol text unique not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_email text not null,
  owner_name text,
  title text not null,
  service text not null,
  description text not null,
  deadline text,
  budget text,
  contact text,
  reference_url text,
  status text not null default 'Enviada',
  admin_response jsonb,
  proposal_decision jsonb,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.request_protocol_seq start 1;

create or replace function public.set_request_protocol()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.protocol is null or new.protocol = '' then
    new.protocol := 'INF-' || extract(year from now())::int || '-' || lpad(nextval('public.request_protocol_seq')::text, 4, '0');
  end if;
  return new;
end; $$;

drop trigger if exists trg_request_protocol on public.requests;
create trigger trg_request_protocol before insert on public.requests
for each row execute function public.set_request_protocol();

create or replace function public.touch_request_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists trg_request_updated_at on public.requests;
create trigger trg_request_updated_at before update on public.requests
for each row execute function public.touch_request_updated_at();

alter table public.requests enable row level security;

drop policy if exists "clients insert own requests" on public.requests;
create policy "clients insert own requests" on public.requests for insert
to authenticated with check (auth.uid() = user_id);

drop policy if exists "clients read own requests" on public.requests;
create policy "clients read own requests" on public.requests for select
to authenticated using (
  auth.uid() = user_id or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "clients update own requests" on public.requests;
create policy "clients update own requests" on public.requests for update
to authenticated using (
  auth.uid() = user_id or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
) with check (
  auth.uid() = user_id or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

grant select, insert, update on public.requests to authenticated;
grant usage, select on sequence public.request_protocol_seq to authenticated;
