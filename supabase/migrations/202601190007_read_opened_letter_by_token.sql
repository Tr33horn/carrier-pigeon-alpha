create extension if not exists pgcrypto with schema extensions;

create or replace function public.read_opened_letter_by_token(p_token text)
returns public.letters
language plpgsql
security definer
set search_path to public
as $$
declare
  v_hash text;
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
    and t.used_at is not null
    and t.expires_at > now()
  limit 1;

  return v_letter;
end;
$$;

grant execute on function public.read_opened_letter_by_token(text) to authenticated;
