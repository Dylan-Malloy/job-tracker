-- Admin panel support: site admins, AI usage/cost log, job status history, member role updates.

-- Site admins (the app operator). Rows are added by hand with SQL; never committed.
create table public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins where user_id = (select auth.uid()));
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- One row per Claude API call. Rows outlive the user/job (set null) so spend history is never lost.
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  hub_id uuid references public.hubs(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  feature text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0
);
create index ai_usage_created_idx on public.ai_usage(created_at desc);
create index ai_usage_user_idx on public.ai_usage(user_id);
create index ai_usage_hub_idx on public.ai_usage(hub_id);
create index ai_usage_job_idx on public.ai_usage(job_id);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon;
create policy ai_usage_admin_select on public.ai_usage for select to authenticated using (private.is_admin());
-- inserts happen only from the server with the service role (no insert policy)

-- Status history for application analytics (time in each stage, hires/rejections over time).
create table public.job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  hub_id uuid not null references public.hubs(id) on delete cascade,
  event text not null check (event in ('created', 'moved')),
  from_status text,
  to_status text,
  outcome text,
  actor uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index job_events_hub_idx on public.job_events(hub_id, created_at desc);
create index job_events_job_idx on public.job_events(job_id);
create index job_events_actor_idx on public.job_events(actor);
alter table public.job_events enable row level security;
revoke all on public.job_events from anon;
create policy job_events_owner_select on public.job_events for select to authenticated using (private.is_owner(hub_id));

create function private.log_job_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.job_events (job_id, hub_id, event, to_status, actor)
    values (new.id, new.hub_id, 'created', new.status, new.added_by);
  elsif new.status is distinct from old.status or new.outcome is distinct from old.outcome then
    insert into public.job_events (job_id, hub_id, event, from_status, to_status, outcome, actor)
    values (new.id, new.hub_id, 'moved', old.status, new.status, new.outcome, (select auth.uid()));
  end if;
  return null;
end;
$$;
revoke all on function private.log_job_event() from public, anon, authenticated;
create trigger jobs_log_event after insert or update on public.jobs
  for each row execute function private.log_job_event();

insert into public.job_events (job_id, hub_id, event, to_status, actor, created_at)
select j.id, j.hub_id, 'created', 'not_started', j.added_by, j.created_at from public.jobs j
where not exists (select 1 from public.job_events e where e.job_id = j.id);

-- Owners can change a member's role (only the role column may change).
create policy members_update on public.hub_members for update to authenticated
  using (private.is_owner(hub_id)) with check (private.is_owner(hub_id));
create function private.members_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.hub_id <> old.hub_id or new.user_id <> old.user_id then
    raise exception 'only the role can change';
  end if;
  return new;
end;
$$;
revoke all on function private.members_guard() from public, anon, authenticated;
create trigger members_guard before update on public.hub_members
  for each row execute function private.members_guard();
