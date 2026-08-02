-- Infotech.io 5.1.1 — Progresso confiável e bloqueio de clientes
-- Execute TODO este arquivo no SQL Editor do Supabase.

begin;

alter table public.profiles
  add column if not exists is_blocked boolean not null default false;

-- Atualiza a função da lista para incluir o estado de bloqueio.
drop function if exists public.admin_list_clients();
create or replace function public.admin_list_clients()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  is_blocked boolean
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
    u.email_confirmed_at,
    coalesce(p.is_blocked, false)
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_list_clients() from public, anon;
grant execute on function public.admin_list_clients() to authenticated;

create or replace function public.admin_set_client_blocked(
  p_client_id uuid,
  p_blocked boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Acesso administrativo necessário';
  end if;

  if exists (select 1 from public.profiles where id = p_client_id and role = 'admin') then
    raise exception 'Uma conta administrativa não pode ser bloqueada por esta tela.';
  end if;

  update public.profiles
  set is_blocked = p_blocked, updated_at = now()
  where id = p_client_id;

  if not found then
    raise exception 'Cliente não encontrado.';
  end if;

  return p_blocked;
end;
$$;

revoke all on function public.admin_set_client_blocked(uuid, boolean) from public, anon;
grant execute on function public.admin_set_client_blocked(uuid, boolean) to authenticated;

-- Mantém o salvamento do progresso disponível para administradores.
create or replace function public.admin_update_request_project(
  p_request_id uuid,
  p_project jsonb,
  p_status text
)
returns public.requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.requests;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Acesso permitido somente para administradores.';
  end if;

  update public.requests
  set project = p_project, status = p_status, updated_at = now()
  where id = p_request_id
  returning * into v_request;

  if v_request.id is null then
    raise exception 'Solicitação não encontrada.';
  end if;

  return v_request;
end;
$$;

grant execute on function public.admin_update_request_project(uuid, jsonb, text) to authenticated;

commit;
notify pgrst, 'reload schema';
