-- InfoTech.io V6.6 — hardening do backend Supabase
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


-- 7) Protege updates do cliente: o cliente só pode ACRESCENTAR uma mensagem própria.
-- Admin continua podendo atualizar status, resposta e mensagens pelo painel.
create or replace function public.v66_guard_client_request_update()
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

  if auth.uid() is null or old.user_id <> auth.uid() or new.user_id <> auth.uid() then
    raise exception 'update not allowed';
  end if;

  -- Nenhuma coluna além de messages/updated_at pode mudar pelo cliente.
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

  -- Removendo o último item, o histórico deve ser exatamente igual ao anterior.
  if (new_messages - (jsonb_array_length(new_messages)-1)) is distinct from old_messages then
    raise exception 'message history cannot be edited';
  end if;

  last_message := new_messages -> (jsonb_array_length(new_messages)-1);
  if coalesce(last_message->>'sender','') <> 'client'
     or length(trim(coalesce(last_message->>'text',''))) < 1 then
    raise exception 'invalid client message';
  end if;

  return new;
end;
$$;

drop trigger if exists v66_guard_client_request_update on public.requests;
create trigger v66_guard_client_request_update
before update on public.requests
for each row execute function public.v66_guard_client_request_update();

-- 8) Arquivos: cliente só vê/envia arquivos das próprias solicitações; admin vê tudo.
drop policy if exists "v66_request_files_select" on public.request_files;
create policy "v66_request_files_select"
on public.request_files for select
to authenticated
using (
  public.is_admin(auth.uid()) or exists (
    select 1 from public.requests r
    where r.id = request_files.request_id and r.user_id = auth.uid()
  )
);

drop policy if exists "v66_request_files_insert" on public.request_files;
create policy "v66_request_files_insert"
on public.request_files for insert
to authenticated
with check (
  uploader_id = auth.uid() and exists (
    select 1 from public.requests r
    where r.id = request_files.request_id and r.user_id = auth.uid()
  )
);

drop policy if exists "v66_request_files_admin_delete" on public.request_files;
create policy "v66_request_files_admin_delete"
on public.request_files for delete
to authenticated
using (public.is_admin(auth.uid()));

grant select, insert, delete on public.request_files to authenticated;

-- 9) Progresso/eventos: cliente somente leitura da própria solicitação; admin gerencia.
drop policy if exists "v66_request_projects_select" on public.request_projects;
create policy "v66_request_projects_select"
on public.request_projects for select
to authenticated
using (
  public.is_admin(auth.uid()) or exists (
    select 1 from public.requests r
    where r.id = request_projects.request_id and r.user_id = auth.uid()
  )
);

drop policy if exists "v66_request_projects_admin_all" on public.request_projects;
create policy "v66_request_projects_admin_all"
on public.request_projects for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

grant select, insert, update, delete on public.request_projects to authenticated;

drop policy if exists "v66_request_events_select" on public.request_events;
create policy "v66_request_events_select"
on public.request_events for select
to authenticated
using (
  public.is_admin(auth.uid()) or exists (
    select 1 from public.requests r
    where r.id = request_events.request_id and r.user_id = auth.uid()
  )
);

drop policy if exists "v66_request_events_admin_all" on public.request_events;
create policy "v66_request_events_admin_all"
on public.request_events for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

grant select, insert, update, delete on public.request_events to authenticated;

-- 10) Storage privado: o caminho começa com o UUID do dono da conta.
drop policy if exists "v66_storage_request_files_select" on storage.objects;
create policy "v66_storage_request_files_select"
on storage.objects for select
to authenticated
using (
  bucket_id = 'request-files' and (
    public.is_admin(auth.uid()) or (storage.foldername(name))[1] = auth.uid()::text
  )
);

drop policy if exists "v66_storage_request_files_insert" on storage.objects;
create policy "v66_storage_request_files_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'request-files' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "v66_storage_request_files_admin_delete" on storage.objects;
create policy "v66_storage_request_files_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'request-files' and public.is_admin(auth.uid()));


commit;
notify pgrst, 'reload schema';
