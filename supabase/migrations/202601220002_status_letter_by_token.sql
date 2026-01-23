create or replace function public.status_letter_by_token(p_token text)
returns table (
  bird_type text,
  dest_region_id text,
  eta_at timestamptz,
  sent_at timestamptz,
  opened_at timestamptz,
  canceled_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(l.bird_type, l.bird) as bird_type,
    l.dest_region_id,
    l.eta_at,
    l.sent_at,
    l.opened_at,
    l.canceled_at
  from public.letters l
  where l.public_token = p_token
  limit 1;
$$;

create or replace function public.open_letter_by_token(p_token text)
returns table (
  id uuid,
  public_token text,
  from_name text,
  to_name text,
  subject text,
  message text,
  bird_type text,
  dest_region_id text,
  eta_at timestamptz,
  opened_at timestamptz,
  recipient_user_id uuid
)
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

  v_hash := encode(extensions.digest(p_token, 'sha256'::text), 'hex');

  select l.* into v_letter
  from public.letter_open_tokens t
  join public.letters l on l.id = t.letter_id
  where t.token_hash = v_hash
    and t.expires_at > now()
  limit 1;

  if v_letter.id is null then
    raise exception 'invalid or expired token';
  end if;

  if v_letter.canceled_at is not null then
    raise exception 'canceled';
  end if;

  if v_letter.eta_at is not null and now() < v_letter.eta_at then
    raise exception 'not_arrived';
  end if;

  if v_letter.recipient_user_id is not null and v_letter.recipient_user_id <> auth.uid() then
    raise exception 'already_opened_by_other_user';
  end if;

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
    where id = v_letter_id;

  return query
    select
      l.id,
      l.public_token,
      l.from_name,
      l.to_name,
      l.subject,
      coalesce(l.message, l.body) as message,
      coalesce(l.bird_type, l.bird) as bird_type,
      l.dest_region_id,
      l.eta_at,
      l.opened_at,
      l.recipient_user_id
    from public.letters l
    where l.id = v_letter_id;
end;
$$;

grant execute on function public.status_letter_by_token(text) to anon, authenticated;
