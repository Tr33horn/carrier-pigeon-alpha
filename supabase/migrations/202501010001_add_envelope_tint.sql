alter table public.letters add column if not exists envelope_tint text;
update public.letters set envelope_tint = 'classic' where envelope_tint is null;
alter table public.letters alter column envelope_tint set default 'classic';
