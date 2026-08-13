-- InfoTech.io V8.0 — hardening de produção para Supabase
-- Execute PRIMEIRO em projeto de teste. Faça backup antes da produção.
-- Este arquivo não contém chaves secretas.
-- Requisitos esperados do projeto atual: public.profiles, public.requests,
-- public.request_files, public.request_projects, public.request_events e bucket request-files.

begin;

-- -----------------------------------------------------------------------------
-- 1. Estado do usuário e privilégios
-- -----------------------------------------------------------------------------
alter table if exists public.profiles
  add column if not exists is_blocked boolean not null default false;

create or replace function public.is_active_user(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select check_user_id is not null
    and check_user_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = check_user_id
        and coalesce(p.is_blocked, false) = false
    );
$$;

revoke all on function public.is_active_user(uuid) from public, anon;
grant execute on function public.is_active_user(uuid) to authenticated;

-- Admin só é considerado admin se estiver ativo. Se já tiver MFA verificado,
-- exige sessão AAL2; antes do primeiro cadastro de MFA continua compatível com AAL1.
create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select check_user_id is not null
  and check_user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = check_user_id
      and p.role = 'admin'
      and coalesce(p.is_blocked, false) = false
  )
  and (
    not exists (
      select 1 from auth.mfa_factors mf
      where mf.user_id = check_user_id and mf.status = 'verified'
    )
    or coalesce(auth.jwt()->>'aal','aal1') = 'aal2'
  );
$$;

revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;

-- Mantém novos cadastros sempre como client; nunca promove por e-mail ou metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_blocked, created_at, updated_at)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'client',
    false,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        role = public.profiles.role,
        is_blocked = public.profiles.is_blocked,
        updated_at = now();
  return new;
end;
$$;

-- Garante que o cadastro em auth.users sempre crie o perfil público.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Sincroniza nome/e-mail após alterações feitas pela tela "Meu perfil",
-- sem conceder UPDATE direto do cliente na tabela profiles.
create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = lower(new.email),
      full_name = coalesce(
        nullif(trim(new.raw_user_meta_data->>'full_name'),''),
        nullif(trim(new.raw_user_meta_data->>'name'),''),
        public.profiles.full_name
      ),
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_sync on auth.users;
create trigger on_auth_user_profile_sync
after update of email, raw_user_meta_data on auth.users
for each row execute procedure public.sync_profile_from_auth();

-- -----------------------------------------------------------------------------
-- 2. RLS e privilégios mínimos
-- -----------------------------------------------------------------------------
alter table if exists public.profiles enable row level security;
alter table if exists public.requests enable row level security;
alter table if exists public.request_files enable row level security;
alter table if exists public.request_events enable row level security;
alter table if exists public.request_projects enable row level security;

-- Perfil: usuário ativo vê apenas o próprio; admin AAL2 vê todos.
drop policy if exists "v6_profiles_select" on public.profiles;
drop policy if exists "v8_profiles_select" on public.profiles;
create policy "v8_profiles_select"
on public.profiles for select
to authenticated
using (
  (id = auth.uid() and public.is_active_user(auth.uid()))
  or public.is_admin(auth.uid())
);

revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

-- Solicitações.
drop policy if exists "v6_requests_select" on public.requests;
drop policy if exists "v6_requests_insert" on public.requests;
drop policy if exists "v6_requests_update" on public.requests;
drop policy if exists "v8_requests_select" on public.requests;
drop policy if exists "v8_requests_insert" on public.requests;
drop policy if exists "v8_requests_update" on public.requests;

create policy "v8_requests_select"
on public.requests for select
to authenticated
using (
  public.is_active_user(auth.uid())
  and (user_id = auth.uid() or public.is_admin(auth.uid()))
);

create policy "v8_requests_insert"
on public.requests for insert
to authenticated
with check (
  public.is_active_user(auth.uid())
  and user_id = auth.uid()
  and length(trim(coalesce(title,''))) between 2 and 140
  and length(trim(coalesce(description,''))) between 10 and 6000
);

create policy "v8_requests_update"
on public.requests for update
to authenticated
using (
  public.is_active_user(auth.uid())
  and (user_id = auth.uid() or public.is_admin(auth.uid()))
)
with check (
  public.is_active_user(auth.uid())
  and (user_id = auth.uid() or public.is_admin(auth.uid()))
);

-- Cliente só pode acrescentar uma mensagem própria; não altera orçamento/status.
create or replace function public.v8_guard_client_request_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_messages jsonb := coalesce(to_jsonb(old)->'messages', '[]'::jsonb);
  new_messages jsonb := coalesce(to_jsonb(new)->'messages', '[]'::jsonb);
  last_message jsonb;
begin
  if public.is_admin(auth.uid()) then
    return new;
  end if;

  if not public.is_active_user(auth.uid())
     or old.user_id <> auth.uid()
     or new.user_id <> auth.uid() then
    raise exception 'update not allowed';
  end if;

  if (to_jsonb(new) - array['messages','updated_at']) is distinct from
     (to_jsonb(old) - array['messages','updated_at']) then
    raise exception 'client cannot change protected request fields';
  end if;

  if jsonb_typeof(old_messages) <> 'array' or jsonb_typeof(new_messages) <> 'array' then
    raise exception 'invalid messages payload';
  end if;

  if jsonb_array_length(new_messages) <> jsonb_array_length(old_messages) + 1 then
    raise exception 'client can only append one message at a time';
  end if;

  if (new_messages - (jsonb_array_length(new_messages)-1)) is distinct from old_messages then
    raise exception 'message history cannot be edited';
  end if;

  last_message := new_messages -> (jsonb_array_length(new_messages)-1);
  if coalesce(last_message->>'sender','') <> 'client'
     or length(trim(coalesce(last_message->>'text',''))) not between 1 and 1200 then
    raise exception 'invalid client message';
  end if;

  return new;
end;
$$;

drop trigger if exists v66_guard_client_request_update on public.requests;
drop trigger if exists v8_guard_client_request_update on public.requests;
create trigger v8_guard_client_request_update
before update on public.requests
for each row execute function public.v8_guard_client_request_update();

-- Arquivos: leitura/envio somente da própria solicitação; delete somente admin.
drop policy if exists "v66_request_files_select" on public.request_files;
drop policy if exists "v66_request_files_insert" on public.request_files;
drop policy if exists "v66_request_files_admin_delete" on public.request_files;
drop policy if exists "v8_request_files_select" on public.request_files;
drop policy if exists "v8_request_files_insert" on public.request_files;
drop policy if exists "v8_request_files_admin_delete" on public.request_files;

create policy "v8_request_files_select"
on public.request_files for select
to authenticated
using (
  public.is_active_user(auth.uid())
  and (
    public.is_admin(auth.uid()) or exists (
      select 1 from public.requests r
      where r.id = request_files.request_id and r.user_id = auth.uid()
    )
  )
);

create policy "v8_request_files_insert"
on public.request_files for insert
to authenticated
with check (
  public.is_active_user(auth.uid())
  and uploader_id = auth.uid()
  and size_bytes > 0 and size_bytes <= 10485760
  and lower(coalesce(mime_type,'')) in ('image/jpeg','image/png','image/webp','application/pdf','text/plain')
  and exists (
    select 1 from public.requests r
    where r.id = request_files.request_id and r.user_id = auth.uid()
  )
);

create policy "v8_request_files_admin_delete"
on public.request_files for delete
to authenticated
using (public.is_admin(auth.uid()));

grant select, insert, delete on public.request_files to authenticated;

-- Projetos/eventos: cliente ativo só lê os próprios; admin gerencia.
drop policy if exists "v66_request_projects_select" on public.request_projects;
drop policy if exists "v66_request_projects_admin_all" on public.request_projects;
drop policy if exists "v8_request_projects_select" on public.request_projects;
drop policy if exists "v8_request_projects_admin_all" on public.request_projects;
create policy "v8_request_projects_select"
on public.request_projects for select
to authenticated
using (
  public.is_active_user(auth.uid()) and (
    public.is_admin(auth.uid()) or exists (
      select 1 from public.requests r
      where r.id = request_projects.request_id and r.user_id = auth.uid()
    )
  )
);
create policy "v8_request_projects_admin_all"
on public.request_projects for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "v66_request_events_select" on public.request_events;
drop policy if exists "v66_request_events_admin_all" on public.request_events;
drop policy if exists "v8_request_events_select" on public.request_events;
drop policy if exists "v8_request_events_admin_all" on public.request_events;
create policy "v8_request_events_select"
on public.request_events for select
to authenticated
using (
  public.is_active_user(auth.uid()) and (
    public.is_admin(auth.uid()) or exists (
      select 1 from public.requests r
      where r.id = request_events.request_id and r.user_id = auth.uid()
    )
  )
);
create policy "v8_request_events_admin_all"
on public.request_events for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

grant select, insert, update, delete on public.request_projects to authenticated;
grant select, insert, update, delete on public.request_events to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Storage privado + allowlist no servidor
-- -----------------------------------------------------------------------------
update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf','text/plain']::text[]
where id = 'request-files';

drop policy if exists "v66_storage_request_files_select" on storage.objects;
drop policy if exists "v66_storage_request_files_insert" on storage.objects;
drop policy if exists "v66_storage_request_files_admin_delete" on storage.objects;
drop policy if exists "v8_storage_request_files_select" on storage.objects;
drop policy if exists "v8_storage_request_files_insert" on storage.objects;
drop policy if exists "v8_storage_request_files_admin_delete" on storage.objects;

create policy "v8_storage_request_files_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'request-files'
  and public.is_active_user(auth.uid())
  and (
    public.is_admin(auth.uid())
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

create policy "v8_storage_request_files_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'request-files'
  and public.is_active_user(auth.uid())
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp','pdf','txt')
);

create policy "v8_storage_request_files_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'request-files' and public.is_admin(auth.uid()));

-- -----------------------------------------------------------------------------
-- 4. RPCs administrativas versionadas e verificadas no servidor
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_clients()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  is_blocked boolean,
  created_at timestamptz,
  updated_at timestamptz,
  email_confirmed_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'admin required';
  end if;
  return query
  select p.id, p.email, p.full_name, p.role, coalesce(p.is_blocked,false),
         p.created_at, p.updated_at, u.email_confirmed_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;
revoke all on function public.admin_list_clients() from public, anon;
grant execute on function public.admin_list_clients() to authenticated;

create or replace function public.admin_set_client_blocked(p_client_id uuid, p_blocked boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'admin required';
  end if;
  if p_client_id = auth.uid() then
    raise exception 'admin cannot block own account';
  end if;
  update public.profiles
  set is_blocked = coalesce(p_blocked,false), updated_at = now()
  where id = p_client_id and role <> 'admin';
  return found;
end;
$$;
revoke all on function public.admin_set_client_blocked(uuid,boolean) from public, anon;
grant execute on function public.admin_set_client_blocked(uuid,boolean) to authenticated;

create or replace function public.admin_save_request_project_v2(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid := nullif(p_payload->>'request_id','')::uuid;
  v_deadline date := nullif(p_payload->>'deadline','')::date;
  v_stages jsonb := coalesce(p_payload->'stages','[]'::jsonb);
  v_history jsonb := coalesce(p_payload->'history','[]'::jsonb);
  v_status text := coalesce(nullif(trim(p_payload->>'status'),''),'Em andamento');
  v_total integer := 0;
  v_done integer := 0;
  v_progress integer := 0;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'admin required';
  end if;
  if v_request_id is null or not exists(select 1 from public.requests r where r.id=v_request_id) then
    raise exception 'invalid request';
  end if;
  if jsonb_typeof(v_stages) <> 'array' or jsonb_array_length(v_stages) > 30 then
    raise exception 'invalid stages';
  end if;
  if jsonb_typeof(v_history) <> 'array' or jsonb_array_length(v_history) > 200 then
    raise exception 'invalid history';
  end if;
  if v_status not in ('Enviada','Lida','Em análise','Orçamento enviado','Aguardando aprovação','Alteração solicitada','Aprovada','Em andamento','Concluída','Cancelada') then
    raise exception 'invalid status';
  end if;

  select count(*), count(*) filter (where coalesce((x->>'done')::boolean,false))
    into v_total, v_done
  from jsonb_array_elements(v_stages) x;
  v_progress := case when v_total=0 then 0 else round((v_done::numeric/v_total::numeric)*100)::integer end;

  update public.request_projects
  set deadline=v_deadline, stages=v_stages, history=v_history, progress=v_progress, updated_at=now()
  where request_id=v_request_id;

  if not found then
    insert into public.request_projects(request_id,deadline,stages,history,progress,updated_at)
    values(v_request_id,v_deadline,v_stages,v_history,v_progress,now());
  end if;

  update public.requests
  set status=v_status,
      project=coalesce(project,'{}'::jsonb) || jsonb_build_object(
        'deadline',v_deadline,'stages',v_stages,'history',v_history,'progress',v_progress
      ),
      updated_at=now()
  where id=v_request_id;

  return jsonb_build_object('ok',true,'progress',v_progress,'status',v_status);
end;
$$;
revoke all on function public.admin_save_request_project_v2(jsonb) from public, anon;
grant execute on function public.admin_save_request_project_v2(jsonb) to authenticated;

commit;
notify pgrst, 'reload schema';
