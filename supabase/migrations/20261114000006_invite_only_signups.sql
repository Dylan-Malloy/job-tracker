-- Invite-only sign-ups, enforced in the database so it also holds for direct calls to Supabase Auth.
-- An account can be created only if (a) the email has a pending, unexpired hub invite, or (b) the email is on
-- the allow-list (used to bootstrap the owner; rows are added manually and never committed).
create table public.signup_allowlist (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.signup_allowlist enable row level security;
revoke all on public.signup_allowlist from anon, authenticated;

create function private.require_invite() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.signup_allowlist a where a.email = lower(new.email))
     or exists (
       select 1 from public.hub_invites i
       where lower(i.email) = lower(new.email) and i.accepted_at is null and i.expires_at > now()
     ) then
    return new;
  end if;
  raise exception 'Sign-ups are by invitation only' using errcode = 'P0001';
end;
$$;
revoke all on function private.require_invite() from public, anon, authenticated;

create trigger a_require_invite
  before insert on auth.users
  for each row execute function private.require_invite();
