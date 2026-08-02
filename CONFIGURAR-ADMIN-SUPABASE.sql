-- Infotech.io — Administrador real pelo Supabase
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

-- Cria/atualiza o perfil automaticamente quando uma conta é cadastrada.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'client'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute procedure public.handle_new_user();

-- Cria perfis para usuários que já existiam antes desta tabela.
insert into public.profiles (id, email, full_name, role, created_at)
select
  id,
  lower(email),
  coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)),
  'client',
  created_at
from auth.users
on conflict (id) do update
set email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    updated_at = now();

-- Marca a conta indicada como administradora.
update public.profiles
set role = 'admin', updated_at = now()
where lower(email) = 'lucasjanoca9@gmail.com';

-- Função segura usada nas políticas sem criar recursão.
create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
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

-- Perfis são atualizados pelo gatilho seguro ligado ao auth.users.
drop policy if exists "Usuário atualiza o próprio perfil" on public.profiles;
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

commit;

-- Confirmação: deve retornar role = admin.
select id, email, role
from public.profiles
where lower(email) = 'lucasjanoca9@gmail.com';
