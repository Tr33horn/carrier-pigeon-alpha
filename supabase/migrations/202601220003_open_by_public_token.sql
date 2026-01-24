create or replace function public.open_letter_by_public_token(p_token text)
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
  v_letter public.letters;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select l.* into v_letter
  from public.letters l
  where l.public_token = p_token
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

  if v_letter.recipient_user_id is not null
    and v_letter.recipient_user_id <> auth.uid()
    and v_letter.sender_user_id <> auth.uid()
  then
    raise exception 'already_opened_by_other_user';
  end if;

  update public.letters
    set recipient_user_id = coalesce(recipient_user_id, auth.uid()),
        opened_at = coalesce(opened_at, now())
    where id = v_letter.id;

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
    where l.id = v_letter.id;
end;
$$;

create or replace function public.read_opened_letter_by_public_token(p_token text)
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
  sender_user_id uuid,
  recipient_user_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

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
      l.sender_user_id,
      l.recipient_user_id
    from public.letters l
    where l.public_token = p_token
      and l.opened_at is not null
      and (l.sender_user_id = auth.uid() or l.recipient_user_id = auth.uid())
    limit 1;
end;
$$;

grant execute on function public.open_letter_by_public_token(text) to authenticated;
grant execute on function public.read_opened_letter_by_public_token(text) to authenticated;
