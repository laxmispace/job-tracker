-- Bring-your-own-key: each user's own AI provider keys.
-- Keys are encrypted by the app server (AES-256-GCM) before they reach this
-- table, so the stored value is useless without the server's secret.
-- Safe to run more than once.

create table if not exists public.user_ai_keys (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider    text not null,
  key_cipher  text not null,          -- base64(iv | tag | ciphertext)
  key_last4   text not null default '',
  source      text not null default 'pasted' check (source in ('pasted','oauth')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, provider)
);

drop trigger if exists user_ai_keys_touch on public.user_ai_keys;
create trigger user_ai_keys_touch before update on public.user_ai_keys
  for each row execute function public.touch_updated_at();

alter table public.user_ai_keys enable row level security;
drop policy if exists "own rows" on public.user_ai_keys;
create policy "own rows" on public.user_ai_keys for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.user_ai_keys to authenticated;
