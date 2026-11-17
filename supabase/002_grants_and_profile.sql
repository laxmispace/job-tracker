-- Run after schema.sql. Safe to run more than once.
--
-- 1) Newer Supabase projects don't automatically let signed-in users use
--    tables created in the SQL editor, which caused
--    "permission denied for table answers". Row level security still limits
--    every user to their own rows.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.jobs, public.answers, public.experiences to authenticated;

-- 2) Profile: your career track and the portfolio / resume text the AI reads.
create table if not exists public.profiles (
  user_id               uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  track                 text not null default 'product_designer'
                        check (track in ('product_designer','software_engineer','ml_engineer','other')),
  portfolio_url         text default '',
  portfolio_text        text default '',     -- readable text fetched from your portfolio pages
  portfolio_pages       jsonb,               -- [{ url, title }] pages that were read
  portfolio_fetched_at  timestamptz,
  resume_text           text default '',     -- text extracted from your uploaded resume
  updated_at            timestamptz not null default now()
);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
drop policy if exists "own rows" on public.profiles;
create policy "own rows" on public.profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.profiles to authenticated;
