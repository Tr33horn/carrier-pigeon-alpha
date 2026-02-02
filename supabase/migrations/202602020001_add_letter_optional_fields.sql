-- Add optional send metadata fields for letters/postcards
alter table public.letters
  add column if not exists stationery_id text,
  add column if not exists delivery_type text,
  add column if not exists postcard_template_id text;
