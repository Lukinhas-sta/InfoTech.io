-- Infotech.io 5.1.2 — Salvamento definitivo do andamento do projeto
-- Execute TODO este arquivo no SQL Editor do Supabase.

begin;

create table if not exists public.request_projects (
  request_id uuid primary key references public.requests(id) on delete cascade,
  deadline date,
  stages jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  progress integer not null default 0 check (progress between 0 and 100),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.request_projects enable row level security;

drop policy if exists request_projects_select_participants on public.request_projects;
create policy request_projects_select_participants
on public.request_projects for select
to authenticated
using (
  public.is_admin(auth.uid())
  or exists (
    select 1 from public.requests r
    where r.id = request_projects.request_id
      and r.user_id = auth.uid()
  )
);

-- Migra dados antigos já salvos no JSON da solicitação.
insert into public.request_projects (request_id, deadline, stages, history, progress, updated_at)
select
  r.id,
  nullif(r.project->>'deadline','')::date,
  coalesce(r.project->'stages','[]'::jsonb),
  coalesce(r.project->'history','[]'::jsonb),
  case
    when jsonb_array_length(coalesce(r.project->'stages','[]'::jsonb)) = 0 then 0
    else round(
      100.0 * (
        select count(*) from jsonb_array_elements(coalesce(r.project->'stages','[]'::jsonb)) s
        where coalesce((s->>'done')::boolean,false)
      ) / jsonb_array_length(coalesce(r.project->'stages','[]'::jsonb))
    )::integer
  end,
  coalesce(r.updated_at, now())
from public.requests r
where r.project is not null
on conflict (request_id) do nothing;

create or replace function public.admin_save_request_project(
  p_request_id uuid,
  p_deadline date,
  p_stages jsonb,
  p_history jsonb,
  p_status text
)
returns table (
  request_id uuid,
  deadline date,
  stages jsonb,
  history jsonb,
  progress integer,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_progress integer;
  v_updated timestamptz := now();
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Acesso permitido somente para administradores.';
  end if;

  if not exists (select 1 from public.requests where id = p_request_id) then
    raise exception 'Solicitação não encontrada.';
  end if;

  if jsonb_typeof(coalesce(p_stages,'[]'::jsonb)) <> 'array' then
    raise exception 'As etapas enviadas são inválidas.';
  end if;

  if jsonb_array_length(coalesce(p_stages,'[]'::jsonb)) = 0 then
    v_progress := 0;
  else
    select round(100.0 * count(*) filter (where coalesce((s->>'done')::boolean,false)) / count(*))::integer
      into v_progress
    from jsonb_array_elements(p_stages) s;
  end if;

  insert into public.request_projects(request_id,deadline,stages,history,progress,updated_at,updated_by)
  values(p_request_id,p_deadline,coalesce(p_stages,'[]'::jsonb),coalesce(p_history,'[]'::jsonb),v_progress,v_updated,auth.uid())
  on conflict(request_id) do update set
    deadline=excluded.deadline,
    stages=excluded.stages,
    history=excluded.history,
    progress=excluded.progress,
    updated_at=excluded.updated_at,
    updated_by=excluded.updated_by;

  -- Mantém compatibilidade com telas e versões anteriores.
  update public.requests
  set
    project = jsonb_build_object(
      'deadline', coalesce(p_deadline::text,''),
      'stages', coalesce(p_stages,'[]'::jsonb),
      'history', coalesce(p_history,'[]'::jsonb),
      'updatedAt', v_updated
    ),
    status = p_status,
    updated_at = v_updated
  where id = p_request_id;

  return query
  select rp.request_id,rp.deadline,rp.stages,rp.history,rp.progress,r.status,rp.updated_at
  from public.request_projects rp
  join public.requests r on r.id=rp.request_id
  where rp.request_id=p_request_id;
end;
$$;

create or replace function public.get_request_project(p_request_id uuid)
returns table (
  request_id uuid,
  deadline date,
  stages jsonb,
  history jsonb,
  progress integer,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.is_admin(auth.uid())
    or exists(select 1 from public.requests r where r.id=p_request_id and r.user_id=auth.uid())
  ) then
    raise exception 'Acesso negado.';
  end if;

  return query
  select rp.request_id,rp.deadline,rp.stages,rp.history,rp.progress,r.status,rp.updated_at
  from public.request_projects rp
  join public.requests r on r.id=rp.request_id
  where rp.request_id=p_request_id;
end;
$$;

revoke all on function public.admin_save_request_project(uuid,date,jsonb,jsonb,text) from public,anon;
revoke all on function public.get_request_project(uuid) from public,anon;
grant execute on function public.admin_save_request_project(uuid,date,jsonb,jsonb,text) to authenticated;
grant execute on function public.get_request_project(uuid) to authenticated;

commit;
notify pgrst, 'reload schema';
