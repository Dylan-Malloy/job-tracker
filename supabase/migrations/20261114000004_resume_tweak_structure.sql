alter table public.resume_tweaks
  add column tailored_resume jsonb,
  add column original_resume jsonb;
