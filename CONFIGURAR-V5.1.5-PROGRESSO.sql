-- Infotech.io 5.1.5 — Correção da ambiguidade request_id
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
    select 1
    from public.requests r
    where r.id = public.request_projects.request_id
      and r.user_id = auth.uid()
  )
);

-- Remove a versão anterior para poder alterar o tipo de retorno.
drop function if exists public.admin_save_request_project_v2(jsonb);

create function public.admin_save_request_project_v2(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_deadline date;
  v_stages jsonb;
  v_history jsonb;
  v_status text;
  v_progress integer;
  v_updated timestamptz := now();
  v_result jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Acesso permitido somente para administradores.';
  end if;

  v_request_id := nullif(p_payload->>'request_id','')::uuid;
  v_deadline := nullif(p_payload->>'deadline','')::date;
  v_stages := coalesce(p_payload->'stages','[]'::jsonb);
  v_history := coalesce(p_payload->'history','[]'::jsonb);
  v_status := coalesce(nullif(p_payload->>'status',''),'Em andamento');

  if v_request_id is null
     or not exists (select 1 from public.requests r where r.id = v_request_id) then
    raise exception 'Solicitação não encontrada.';
  end if;

  if jsonb_typeof(v_stages) <> 'array' then
    raise exception 'As etapas enviadas são inválidas.';
  end if;

  if jsonb_array_length(v_stages) = 0 then
    v_progress := 0;
  else
    select round(
      100.0 * count(*) filter (
        where coalesce((stage_item->>'done')::boolean, false)
      ) / count(*)
    )::integer
    into v_progress
    from jsonb_array_elements(v_stages) as stage_item;
  end if;

  insert into public.request_projects as rp
    (request_id, deadline, stages, history, progress, updated_at, updated_by)
  values
    (v_request_id, v_deadline, v_stages, v_history, v_progress, v_updated, auth.uid())
  on conflict on constraint request_projects_pkey
  do update set
    deadline = excluded.deadline,
    stages = excluded.stages,
    history = excluded.history,
    progress = excluded.progress,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by;

  update public.requests as req
  set
    project = jsonb_build_object(
      'deadline', coalesce(v_deadline::text,''),
      'stages', v_stages,
      'history', v_history,
      'updatedAt', v_updated
    ),
    status = v_status,
    updated_at = v_updated
  where req.id = v_request_id;

  select jsonb_build_object(
    'request_id', rp.request_id,
    'deadline', rp.deadline,
    'stages', rp.stages,
    'history', rp.history,
    'progress', rp.progress,
    'status', req.status,
    'updated_at', rp.updated_at
  )
  into v_result
  from public.request_projects as rp
  join public.requests as req on req.id = rp.request_id
  where rp.request_id = v_request_id;

  return v_result;
end;
$$;

revoke all on function public.admin_save_request_project_v2(jsonb) from public, anon;
grant execute on function public.admin_save_request_project_v2(jsonb) to authenticated;

commit;
notify pgrst, 'reload schema';
