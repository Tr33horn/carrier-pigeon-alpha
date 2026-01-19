-- Store per-letter sleep parameters for consistent replay
alter table public.letters
  add column if not exists sleep_offset_min integer,
  add column if not exists sleep_start_hour integer,
  add column if not exists sleep_end_hour integer;

-- Best-effort backfill: midpoint longitude offset (hours rounded, clamped UTC-12..UTC+14)
update public.letters
set sleep_offset_min = greatest(least(round(((origin_lon + dest_lon) / 2.0) / 15.0) * 60, 14 * 60), -12 * 60)
where sleep_offset_min is null
  and origin_lon is not null
  and dest_lon is not null;
