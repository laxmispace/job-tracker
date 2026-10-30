-- Job Tracker schema. Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run more than once.

create extension if not exists pgcrypto;

-- ───────────────────────────── jobs ─────────────────────────────
create table if not exists public.jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  url           text not null,               -- canonical posting link
  title         text not null default '',
  company       text not null default '',
  location      text default '',
  source        text default 'other',        -- linkedin | greenhouse | lever | workday | naukri | other
  status        text not null default 'applied'
                check (status in ('saved','applied','interview','offer','rejected','ghosted')),
  applied_at    timestamptz,
  description   text default '',             -- snapshot of the JD (postings get taken down)
  notes         text default '',
  salary        text default '',
  tailored      jsonb,                       -- AI-tailored experience for this job
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, url)
);
create index if not exists jobs_user_status_idx on public.jobs (user_id, status, created_at desc);

-- ─────────────────────────── answers ────────────────────────────
-- Your reusable answers for application forms. `aliases` are extra phrases
-- the autofill uses to recognise the question on different sites.
create table if not exists public.answers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key        text not null,                  -- stable slug, e.g. notice_period
  category   text not null default 'other',
  question   text not null,
  answer     text not null default '',
  aliases    text[] not null default '{}',
  long_form  boolean not null default false, -- paragraph answers (AI may adapt per job)
  sort       int not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

-- ────────────────────────── experiences ─────────────────────────
create table if not exists public.experiences (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company     text not null default '',
  title       text not null default '',
  location    text default '',
  start_date  text default '',               -- free text, e.g. "Jan 2023"
  end_date    text default '',               -- "Present" allowed
  bullets     text not null default '',      -- one achievement per line
  skills      text default '',
  sort        int not null default 0,
  updated_at  timestamptz not null default now()
);

-- ─────────────────────── updated_at trigger ─────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch before update on public.jobs
  for each row execute function public.touch_updated_at();
drop trigger if exists answers_touch on public.answers;
create trigger answers_touch before update on public.answers
  for each row execute function public.touch_updated_at();
drop trigger if exists experiences_touch on public.experiences;
create trigger experiences_touch before update on public.experiences
  for each row execute function public.touch_updated_at();

-- ───────────────────── row level security ───────────────────────
-- Every row is visible only to the user who owns it.
alter table public.jobs        enable row level security;
alter table public.answers     enable row level security;
alter table public.experiences enable row level security;

do $$
declare t text;
begin
  foreach t in array array['jobs','answers','experiences'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ───────────────────── resume storage bucket ────────────────────
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

drop policy if exists "own resume read"   on storage.objects;
drop policy if exists "own resume write"  on storage.objects;
drop policy if exists "own resume update" on storage.objects;
drop policy if exists "own resume delete" on storage.objects;

-- Files live at resumes/<user_id>/<filename>
create policy "own resume read" on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own resume write" on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own resume update" on storage.objects for update to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own resume delete" on storage.objects for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
