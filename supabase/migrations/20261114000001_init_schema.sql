-- Job Application Hub: schema, helper functions, triggers, RLS, storage.

create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------- Tables ----------
create table public.hubs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'My Job Hub',
  created_at timestamptz not null default now()
);

create table public.hub_members (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.hubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer', 'helper')),
  member_email text,
  created_at timestamptz not null default now(),
  unique (hub_id, user_id)
);
create index hub_members_user_id_idx on public.hub_members(user_id);

create table public.hub_invites (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.hubs(id) on delete cascade,
  email text not null,
  role text not null check (role in ('viewer', 'helper')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index hub_invites_hub_id_idx on public.hub_invites(hub_id);

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.hubs(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  filename text not null,
  kind text not null check (kind in ('pdf', 'docx')),
  approved boolean not null default false,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index resumes_hub_id_idx on public.resumes(hub_id);
create index resumes_uploaded_by_idx on public.resumes(uploaded_by);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.hubs(id) on delete cascade,
  url text not null,
  normalized_url text not null,
  company text not null default '',
  position text not null default '',
  requirements text[] not null default '{}',
  description text,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'finished')),
  outcome text check (outcome in ('accepted', 'denied')),
  resume_id uuid references public.resumes(id) on delete set null,
  added_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hub_id, normalized_url),
  check (status = 'finished' or outcome is null),
  check (status <> 'finished' or outcome is not null)
);
create index jobs_hub_status_idx on public.jobs(hub_id, status);
create index jobs_resume_id_idx on public.jobs(resume_id);
create index jobs_added_by_idx on public.jobs(added_by);

create table public.resume_tweaks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  original_text text not null,
  tweaked_text text not null,
  changes jsonb not null default '[]',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index resume_tweaks_job_idx on public.resume_tweaks(job_id);
create index resume_tweaks_resume_idx on public.resume_tweaks(resume_id);
create index resume_tweaks_created_by_idx on public.resume_tweaks(created_by);
create index hub_invites_created_by_idx on public.hub_invites(created_by);

-- ---------- Helper functions (role is read live, so revocation is immediate) ----------
create function private.is_owner(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.hubs where id = h and owner_id = (select auth.uid()));
$$;

create function private.hub_role(h uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.hubs where id = h and owner_id = (select auth.uid())) then 'owner'
    else (select m.role from public.hub_members m where m.hub_id = h and m.user_id = (select auth.uid()))
  end;
$$;

create function private.is_member(h uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.hub_role(h) is not null;
$$;

revoke all on function private.is_owner(uuid), private.hub_role(uuid), private.is_member(uuid) from public, anon;
grant execute on function private.is_owner(uuid), private.hub_role(uuid), private.is_member(uuid) to authenticated;

-- ---------- Triggers ----------
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.hubs (owner_id) values (new.id);
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.jobs_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.hub_id <> old.hub_id then
    raise exception 'hub_id cannot change';
  end if;
  if new.resume_id is not null and not exists (
    select 1 from public.resumes r
    where r.id = new.resume_id and r.hub_id = new.hub_id and r.approved
  ) then
    raise exception 'resume must belong to this hub and be approved';
  end if;
  return new;
end;
$$;
revoke all on function private.jobs_guard() from public, anon, authenticated;
create trigger jobs_guard before insert or update on public.jobs
  for each row execute function private.jobs_guard();

create function private.resumes_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.hub_id <> old.hub_id or new.storage_path <> old.storage_path
       or new.uploaded_by <> old.uploaded_by or new.kind <> old.kind then
      raise exception 'only approval fields may change';
    end if;
    if new.approved and not old.approved then
      new.approved_by := (select auth.uid());
      new.approved_at := now();
    elsif not new.approved then
      new.approved_by := null;
      new.approved_at := null;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.resumes_guard() from public, anon, authenticated;
create trigger resumes_guard before update on public.resumes
  for each row execute function private.resumes_guard();

-- ---------- Privileges & RLS ----------
revoke all on public.hubs, public.hub_members, public.hub_invites, public.resumes,
  public.jobs, public.resume_tweaks from anon;

alter table public.hubs enable row level security;
alter table public.hub_members enable row level security;
alter table public.hub_invites enable row level security;
alter table public.resumes enable row level security;
alter table public.jobs enable row level security;
alter table public.resume_tweaks enable row level security;

-- hubs
create policy hubs_select on public.hubs for select to authenticated
  using (private.is_member(id));
create policy hubs_update on public.hubs for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- hub_members (inserts happen only via the server's invite-accept flow)
create policy members_select on public.hub_members for select to authenticated
  using (private.is_member(hub_id));
create policy members_delete on public.hub_members for delete to authenticated
  using (private.is_owner(hub_id) or user_id = (select auth.uid()));

-- hub_invites (owner only; acceptance is verified server-side)
create policy invites_select on public.hub_invites for select to authenticated
  using (private.is_owner(hub_id));
create policy invites_insert on public.hub_invites for insert to authenticated
  with check (private.is_owner(hub_id) and created_by = (select auth.uid()));
create policy invites_delete on public.hub_invites for delete to authenticated
  using (private.is_owner(hub_id));

-- jobs
create policy jobs_select on public.jobs for select to authenticated
  using (private.is_member(hub_id));
create policy jobs_insert on public.jobs for insert to authenticated
  with check (
    added_by = (select auth.uid()) and (
      private.is_owner(hub_id)
      or (private.hub_role(hub_id) = 'helper' and status = 'not_started'
          and outcome is null and resume_id is null)
    )
  );
create policy jobs_update on public.jobs for update to authenticated
  using (private.is_owner(hub_id)) with check (private.is_owner(hub_id));
create policy jobs_delete on public.jobs for delete to authenticated
  using (private.is_owner(hub_id));

-- resumes
create policy resumes_select on public.resumes for select to authenticated
  using (private.is_member(hub_id));
create policy resumes_insert on public.resumes for insert to authenticated
  with check (
    uploaded_by = (select auth.uid()) and (
      private.is_owner(hub_id)
      or (private.hub_role(hub_id) = 'helper' and approved = false and approved_by is null)
    )
  );
create policy resumes_update on public.resumes for update to authenticated
  using (private.is_owner(hub_id)) with check (private.is_owner(hub_id));
create policy resumes_delete on public.resumes for delete to authenticated
  using (private.is_owner(hub_id));

-- resume_tweaks (AI assistant output: owner creates, members can read)
create policy tweaks_select on public.resume_tweaks for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and private.is_member(j.hub_id)));
create policy tweaks_insert on public.resume_tweaks for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.jobs j where j.id = job_id and private.is_owner(j.hub_id))
  );
create policy tweaks_delete on public.resume_tweaks for delete to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and private.is_owner(j.hub_id)));

-- ---------- Storage: private bucket; uploads only via the server (service role) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 10485760,
  array['application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

create policy resumes_files_select on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and private.is_member(((storage.foldername(name))[1])::uuid));
create policy resumes_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'resumes' and private.is_owner(((storage.foldername(name))[1])::uuid));
