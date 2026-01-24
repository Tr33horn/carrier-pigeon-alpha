drop function if exists public.status_letter_by_token(text);

create or replace function public.status_letter_by_token(p_token text)
returns table (
  bird_type text,
  from_name text,
  subject text,
  seal_id text,
  envelope_tint text,
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
    l.from_name,
    l.subject,
    l.seal_id,
    l.envelope_tint,
    l.dest_region_id,
    l.eta_at,
    l.sent_at,
    l.opened_at,
    l.canceled_at
  from public.letters l
  where l.public_token = p_token
  limit 1;
$$;

grant execute on function public.status_letter_by_token(text) to anon, authenticated;
