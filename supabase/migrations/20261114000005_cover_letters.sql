create table public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  letter jsonb not null,
  body_text text not null,
  source_label text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index cover_letters_job_idx on public.cover_letters(job_id);
create index cover_letters_created_by_idx on public.cover_letters(created_by);

revoke all on public.cover_letters from anon;
alter table public.cover_letters enable row level security;

create policy letters_select on public.cover_letters for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and private.is_member(j.hub_id)));
create policy letters_insert on public.cover_letters for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.jobs j where j.id = job_id and private.is_owner(j.hub_id))
  );
create policy letters_delete on public.cover_letters for delete to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and private.is_owner(j.hub_id)));
