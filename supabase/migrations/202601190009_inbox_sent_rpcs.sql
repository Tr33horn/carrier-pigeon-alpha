create or replace function public.get_inbox_letters()
returns table(
  id uuid,
  bird_type text,
  dest_region_id text,
  eta_at timestamptz,
  created_at timestamptz,
  opened_at timestamptz,
  message text
)
language sql
security definer
set search_path to public
as $$
  select
    l.id,
    l.bird_type,
    l.dest_region_id,
    l.eta_at,
    l.created_at,
    l.opened_at,
    l.message
  from public.letters l
  where auth.uid() is not null
    and l.recipient_user_id = auth.uid()
  order by l.created_at desc
  limit 50;
$$;

create or replace function public.get_sent_letters()
returns table(
  id uuid,
  bird_type text,
  dest_region_id text,
  eta_at timestamptz,
  created_at timestamptz,
  message text,
  to_name text,
  to_email text
)
language sql
security definer
set search_path to public
as $$
  select
    l.id,
    l.bird_type,
    l.dest_region_id,
    l.eta_at,
    l.created_at,
    l.message,
    l.to_name,
    l.to_email
  from public.letters l
  where auth.uid() is not null
    and l.sender_user_id = auth.uid()
  order by l.created_at desc
  limit 50;
$$;

grant execute on function public.get_inbox_letters() to authenticated;
grant execute on function public.get_sent_letters() to authenticated;
