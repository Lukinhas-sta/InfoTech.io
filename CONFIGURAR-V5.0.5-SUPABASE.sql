-- Infotech.io 5.0.5 — arquivos, histórico e notificações online
-- Execute após os SQLs das versões anteriores.

alter table public.requests add column if not exists project jsonb not null default jsonb_build_object(
  'deadline','',
  'stages',jsonb_build_array(
    jsonb_build_object('id','stage-1','name','Planejamento','done',false,'doneAt',null),
    jsonb_build_object('id','stage-2','name','Design','done',false,'doneAt',null),
    jsonb_build_object('id','stage-3','name','Desenvolvimento','done',false,'doneAt',null),
    jsonb_build_object('id','stage-4','name','Testes','done',false,'doneAt',null),
    jsonb_build_object('id','stage-5','name','Entrega','done',false,'doneAt',null)
  ),
  'history','[]'::jsonb,
  'updatedAt',null
);

create table if not exists public.request_files (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('client','admin')),
  sender_name text,
  file_name text not null,
  storage_path text unique not null,
  mime_type text,
  size_bytes bigint not null default 0,
  read_by_admin boolean not null default false,
  read_by_client boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text not null default 'system' check (actor_role in ('client','admin','system')),
  event_type text not null,
  title text not null,
  description text,
  read_by_admin boolean not null default false,
  read_by_client boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.request_files enable row level security;
alter table public.request_events enable row level security;

-- Acesso aos arquivos conforme a solicitação.
drop policy if exists "request members read files" on public.request_files;
create policy "request members read files" on public.request_files for select to authenticated using (
  exists (select 1 from public.requests r where r.id=request_id and (
    r.user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
  ))
);
drop policy if exists "request members upload files" on public.request_files;
create policy "request members upload files" on public.request_files for insert to authenticated with check (
  uploader_id=auth.uid() and exists (select 1 from public.requests r where r.id=request_id and (
    r.user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
  ))
);
drop policy if exists "uploader or admin updates files" on public.request_files;
create policy "uploader or admin updates files" on public.request_files for update to authenticated using (
  uploader_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
) with check (
  uploader_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
);
drop policy if exists "uploader or admin deletes files" on public.request_files;
create policy "uploader or admin deletes files" on public.request_files for delete to authenticated using (
  uploader_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
);

-- Histórico e notificações.
drop policy if exists "request members read events" on public.request_events;
create policy "request members read events" on public.request_events for select to authenticated using (
  exists (select 1 from public.requests r where r.id=request_id and (
    r.user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
  ))
);
drop policy if exists "request members create events" on public.request_events;
create policy "request members create events" on public.request_events for insert to authenticated with check (
  actor_id=auth.uid() and exists (select 1 from public.requests r where r.id=request_id and (
    r.user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
  ))
);
drop policy if exists "request members mark events read" on public.request_events;
create policy "request members mark events read" on public.request_events for update to authenticated using (
  exists (select 1 from public.requests r where r.id=request_id and (
    r.user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
  ))
) with check (true);

grant select, insert, update, delete on public.request_files to authenticated;
grant select, insert, update on public.request_events to authenticated;

-- Bucket privado de arquivos.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('request-files','request-files',false,10485760,array[
  'image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain',
  'application/zip','application/x-zip-compressed','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]) on conflict (id) do update set public=false,file_size_limit=10485760;

drop policy if exists "request members read storage" on storage.objects;
create policy "request members read storage" on storage.objects for select to authenticated using (
  bucket_id='request-files' and exists (
    select 1 from public.request_files f join public.requests r on r.id=f.request_id
    where f.storage_path=name and (r.user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
  )
);
drop policy if exists "authenticated upload request storage" on storage.objects;
create policy "authenticated upload request storage" on storage.objects for insert to authenticated with check (
  bucket_id='request-files' and auth.uid()::text=(storage.foldername(name))[1]
);
drop policy if exists "uploader or admin delete request storage" on storage.objects;
create policy "uploader or admin delete request storage" on storage.objects for delete to authenticated using (
  bucket_id='request-files' and exists (
    select 1 from public.request_files f where f.storage_path=name and (
      f.uploader_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
    )
  )
);

-- Gera evento automaticamente quando uma solicitação nasce.
create or replace function public.log_new_request_event()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.request_events(request_id,actor_id,actor_role,event_type,title,description,read_by_client)
  values(new.id,new.user_id,'client','request_created','Solicitação criada',new.protocol || ' · ' || new.title,true);
  return new;
end; $$;
drop trigger if exists trg_log_new_request_event on public.requests;
create trigger trg_log_new_request_event after insert on public.requests
for each row execute function public.log_new_request_event();

-- Inclui as tabelas no Realtime.
do $$ begin
  alter publication supabase_realtime add table public.requests;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.request_files;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.request_events;
exception when duplicate_object then null; end $$;
