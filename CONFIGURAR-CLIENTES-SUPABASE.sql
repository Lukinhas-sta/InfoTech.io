-- Infotech.io 5.0.3 — Lista de contas do Supabase no painel administrativo
-- Execute TODO este arquivo em Supabase > SQL Editor > New query > Run.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'client' check (role in ('client', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, created_at, updated_at)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when lower(new.email) = 'lucasjanoca9@gmail.com' then 'admin' else 'client' end,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        role = case when excluded.email = 'lucasjanoca9@gmail.com' then 'admin' else public.profiles.role end,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute procedure public.handle_new_user();

insert into public.profiles (id, email, full_name, role, created_at, updated_at)
select
  id,
  lower(email),
  coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)),
  case when lower(email) = 'lucasjanoca9@gmail.com' then 'admin' else 'client' end,
  created_at,
  now()
from auth.users
on conflict (id) do update
set email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    role = case when excluded.email = 'lucasjanoca9@gmail.com' then 'admin' else public.profiles.role end,
    updated_at = now();

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = check_user_id and role = 'admin'
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

alter table public.profiles enable row level security;
drop policy if exists "Usuário lê o próprio perfil" on public.profiles;
create policy "Usuário lê o próprio perfil"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin(auth.uid()));
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- Retorna a mesma base de usuários vista em Authentication > Users,
-- mas somente quando a pessoa autenticada possui role = admin.
create or replace function public.admin_list_clients()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Acesso administrativo necessário';
  end if;

  return query
  select
    u.id,
    lower(u.email)::text,
    coalesce(p.full_name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))::text,
    coalesce(p.role, 'client')::text,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_list_clients() from public, anon;
grant execute on function public.admin_list_clients() to authenticated;

commit;

select id, email, role from public.profiles order by created_at desc;
