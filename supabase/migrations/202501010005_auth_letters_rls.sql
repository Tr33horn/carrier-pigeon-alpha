-- Auth + letter preview/open schema
create extension if not exists "pgcrypto";

-- -------------------------------------------------
-- Upgrade legacy letters table (compat)
-- -------------------------------------------------
create or replace function public.jwt_email()
returns text
language sql
stable
as $$
  select nullif(((current_setting('request.jwt.claims', true))::json ->> 'email'), '')
$$;

alter table public.letters
  add column if not exists sender_user_id uuid,
  add column if not exists recipient_user_id uuid,
  add column if not exists opened_at timestamptz,
  add column if not exists bird_type text,
  add column if not exists dest_region_id text,
  add column if not exists message text;

update public.letters
set
  bird_type = coalesce(bird_type, bird),
  dest_region_id = coalesce(dest_region_id, dest_name),
  message = coalesce(message, body)
where
  bird_type is null
  or dest_region_id is null
  or message is null;

-- -------------------------------------------------
-- Profiles
-- -------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Only the user can read/write their profile row.
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- -------------------------------------------------
-- Identities (email/phone claims, no self-verify)
-- -------------------------------------------------
create table if not exists public.identities (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('email','phone')),
  value text not null,
  verified_at timestamptz null,
  unique(type, value)
);

alter table public.identities enable row level security;

-- Users can see their own identities. Only unverified self-insert allowed.
create policy "identities_select_own" on public.identities
  for select using (user_id = auth.uid());
create policy "identities_insert_own_unverified" on public.identities
  for insert with check (user_id = auth.uid() and verified_at is null);

-- -------------------------------------------------
-- Letters (auth-gated full content)
-- -------------------------------------------------
create table if not exists public.letters (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid null references auth.users(id) on delete set null,
  recipient_email text null,
  recipient_phone text null,
  bird_type text not null,
  dest_region_id text not null,
  eta_at timestamptz not null,
  message text not null,
  opened_at timestamptz null,
  created_at timestamptz default now()
);

alter table public.letters enable row level security;

-- Only sender or claimed recipient can read.
drop policy if exists "letters_select_owner_or_recipient" on public.letters;
create policy "letters_select_owner_or_recipient"
on public.letters
for select
to authenticated
using (
  sender_user_id = auth.uid()
  or recipient_user_id = auth.uid()
  or from_email = public.jwt_email()
  or to_email = public.jwt_email()
);

-- Only sender can insert.
drop policy if exists "letters_insert_sender" on public.letters;
create policy "letters_insert_sender"
on public.letters
for insert
to authenticated
with check (
  sender_user_id = auth.uid()
  or from_email = public.jwt_email()
);

-- Sender can update own letters (pre-send enforcement can be added later).
create policy "letters_update_sender" on public.letters
  for update using (sender_user_id = auth.uid()) with check (sender_user_id = auth.uid());

-- -------------------------------------------------
-- Letter open tokens (single-use; no client access)
-- -------------------------------------------------
create table if not exists public.letter_open_tokens (
  id bigserial primary key,
  letter_id uuid references public.letters(id) on delete cascade,
  token_hash text unique not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  used_at timestamptz null
);

alter table public.letter_open_tokens enable row level security;

-- -------------------------------------------------
-- Gift bundles
-- -------------------------------------------------
create table if not exists public.gift_bundles (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid null references public.letters(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid null references auth.users(id) on delete set null,
  status text not null,
  sealed_at timestamptz null,
  claimed_at timestamptz null,
  created_at timestamptz default now()
);

alter table public.gift_bundles enable row level security;

-- Owner or recipient can read.
create policy "gift_bundles_select_owner_or_recipient" on public.gift_bundles
  for select using (created_by = auth.uid() or recipient_user_id = auth.uid());

-- Owner can create bundles.
create policy "gift_bundles_insert_owner" on public.gift_bundles
  for insert with check (created_by = auth.uid());

-- Owner can update only while building.
create policy "gift_bundles_update_owner_building" on public.gift_bundles
  for update using (created_by = auth.uid() and status = 'building')
  with check (created_by = auth.uid() and status = 'building');

-- -------------------------------------------------
-- Gift items
-- -------------------------------------------------
create table if not exists public.gift_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid references public.gift_bundles(id) on delete cascade,
  kind text not null,
  partner_id text null,
  metadata_json jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz default now()
);

alter table public.gift_items enable row level security;

-- Read if bundle is visible to owner or recipient.
create policy "gift_items_select_bundle_visible" on public.gift_items
  for select using (
    exists (
      select 1 from public.gift_bundles b
      where b.id = gift_items.bundle_id
        and (b.created_by = auth.uid() or b.recipient_user_id = auth.uid())
    )
  );

-- Modify only by bundle owner while building.
create policy "gift_items_insert_owner_building" on public.gift_items
  for insert with check (
    exists (
      select 1 from public.gift_bundles b
      where b.id = gift_items.bundle_id
        and b.created_by = auth.uid()
        and b.status = 'building'
    )
  );
create policy "gift_items_update_owner_building" on public.gift_items
  for update using (
    exists (
      select 1 from public.gift_bundles b
      where b.id = gift_items.bundle_id
        and b.created_by = auth.uid()
        and b.status = 'building'
    )
  )
  with check (
    exists (
      select 1 from public.gift_bundles b
      where b.id = gift_items.bundle_id
        and b.created_by = auth.uid()
        and b.status = 'building'
    )
  );
create policy "gift_items_delete_owner_building" on public.gift_items
  for delete using (
    exists (
      select 1 from public.gift_bundles b
      where b.id = gift_items.bundle_id
        and b.created_by = auth.uid()
        and b.status = 'building'
    )
  );

-- -------------------------------------------------
-- Tokens
-- -------------------------------------------------
create table if not exists public.tokens (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  token_type text not null,
  status text not null,
  amount numeric not null,
  currency text not null default 'USD',
  minted_at timestamptz default now(),
  expires_at timestamptz null
);

alter table public.tokens enable row level security;

-- Owner can read their tokens. No client write policies.
create policy "tokens_select_owner" on public.tokens
  for select using (owner_user_id = auth.uid());

-- -------------------------------------------------
-- Ledger entries
-- -------------------------------------------------
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  token_id uuid references public.tokens(id) on delete cascade,
  direction text not null check (direction in ('debit','credit')),
  amount numeric not null,
  reason text not null,
  ref_type text null,
  ref_id uuid null,
  created_at timestamptz default now()
);

alter table public.ledger_entries enable row level security;

-- Read only if the underlying token belongs to the user.
create policy "ledger_entries_select_owner" on public.ledger_entries
  for select using (
    exists (
      select 1 from public.tokens t
      where t.id = ledger_entries.token_id
        and t.owner_user_id = auth.uid()
    )
  );

-- -------------------------------------------------
-- Idempotency keys (optional)
-- -------------------------------------------------
create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  key text not null,
  created_at timestamptz default now(),
  unique(user_id, key)
);

alter table public.idempotency_keys enable row level security;

-- Users can read/write only their keys.
create policy "idempotency_keys_select_own" on public.idempotency_keys
  for select using (user_id = auth.uid());
create policy "idempotency_keys_insert_own" on public.idempotency_keys
  for insert with check (user_id = auth.uid());

-- -------------------------------------------------
-- Secure RPCs
-- -------------------------------------------------
create or replace function public.preview_letter_by_token(p_token text)
returns table (bird_type text, dest_region_id text, eta_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select l.bird_type, l.dest_region_id, l.eta_at
    from public.letter_open_tokens t
    join public.letters l on l.id = t.letter_id
    where t.token_hash = encode(digest(p_token, 'sha256'), 'hex')
      and t.used_at is null
      and t.expires_at > now()
    limit 1;
end;
$$;

create or replace function public.open_letter_by_token(p_token text)
returns public.letters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_letter_id uuid;
  v_letter public.letters;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  with updated as (
    update public.letter_open_tokens
    set used_at = now()
    where token_hash = v_hash
      and used_at is null
      and expires_at > now()
    returning letter_id
  )
  select letter_id into v_letter_id from updated;

  if v_letter_id is null then
    raise exception 'invalid or expired token';
  end if;

  update public.letters
    set recipient_user_id = coalesce(recipient_user_id, auth.uid()),
        opened_at = coalesce(opened_at, now())
    where id = v_letter_id
    returning * into v_letter;

  return v_letter;
end;
$$;

revoke all on function public.preview_letter_by_token(text) from public;
revoke all on function public.open_letter_by_token(text) from public;

grant execute on function public.preview_letter_by_token(text) to anon, authenticated;
grant execute on function public.open_letter_by_token(text) to authenticated;
