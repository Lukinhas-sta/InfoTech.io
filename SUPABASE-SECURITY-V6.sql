-- InfoTech.io V6 — hardening do backend Supabase
-- IMPORTANTE: execute em ambiente de teste antes da produção.
-- Este patch NÃO coloca segredo no navegador e NÃO cria admin por e-mail.

begin;

-- 1) Mantém o papel (role) existente e impede promoção automática de novos usuários por e-mail.
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
    'client',
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        role = public.profiles.role,
        updated_at = now();
  return new;
end;
$$;

-- 2) Garante RLS nas tabelas sensíveis já usadas pelo site.
alter table if exists public.profiles enable row level security;
alter table if exists public.requests enable row level security;
alter table if exists public.request_files enable row level security;
alter table if exists public.request_events enable row level security;
alter table if exists public.request_projects enable row level security;

-- 3) Função de administrador continua verificando o role no banco.
create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = check_user_id and role = 'admin'
  );
$$;
revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;

-- 4) Perfis: cliente lê apenas o próprio perfil; admin pode ler todos.
drop policy if exists "v6_profiles_select" on public.profiles;
create policy "v6_profiles_select"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin(auth.uid()));

-- Não permita edição direta de role pelo navegador.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- 5) Solicitações: isolamento por dono ou admin.
drop policy if exists "v6_requests_select" on public.requests;
create policy "v6_requests_select"
on public.requests for select
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "v6_requests_insert" on public.requests;
create policy "v6_requests_insert"
on public.requests for insert
to authenticated
with check (user_id = auth.uid());

-- Mantém update compatível com a versão atual; para máxima segurança,
-- migre mensagens/status para RPCs antes de restringir colunas.
drop policy if exists "v6_requests_update" on public.requests;
create policy "v6_requests_update"
on public.requests for update
to authenticated
using (user_id = auth.uid() or public.is_admin(auth.uid()))
with check (user_id = auth.uid() or public.is_admin(auth.uid()));

-- 6) Bucket privado e limite de 10 MB.
update storage.buckets
set public=false, file_size_limit=10485760
where id='request-files';

commit;
notify pgrst, 'reload schema';
