-- Alimentation des buckets — en une seule requête ensembliste par batch
-- inséré (pas de boucle ligne par ligne), donc le coût ne dépend pas du
-- nombre de CDR dans le batch mais du nombre de (msisdn, cellule, bucket
-- 5 min) distincts qu'il touche.
create or replace function shield_upsert_buckets()
returns trigger language plpgsql as $$
begin
  insert into shield_cdr_buckets (
    msisdn_a, cell_id, bucket_start, operator_id,
    total_calls, out_calls, in_calls, intl_calls, call_in_intl,
    premium_calls, premium_prefix_calls, short_calls, flash_calls, zero_calls,
    night_calls, out_night_calls, sum_duration_sec, sum_intl_duration_sec
  )
  select
    msisdn_a,
    coalesce(cell_id, '_none_'),
    to_timestamp(floor(extract(epoch from start_time) / 300) * 300),
    max(operator_id),
    count(*),
    count(*) filter (where call_type = 'OUT'),
    count(*) filter (where call_type = 'IN'),
    count(*) filter (where is_international),
    count(*) filter (where call_type = 'IN' and is_international),
    count(*) filter (where is_premium),
    count(*) filter (where is_premium and country_code_b in ('881','882','883')),
    count(*) filter (where duration_sec < 3),
    count(*) filter (where duration_sec <= 1),
    count(*) filter (where duration_sec = 0),
    count(*) filter (where extract(hour from start_time) >= 22 or extract(hour from start_time) < 6),
    count(*) filter (where call_type = 'OUT' and (extract(hour from start_time) >= 22 or extract(hour from start_time) < 6)),
    coalesce(sum(duration_sec), 0),
    coalesce(sum(duration_sec) filter (where is_international), 0)
  from new_rows
  group by msisdn_a, coalesce(cell_id, '_none_'), to_timestamp(floor(extract(epoch from start_time) / 300) * 300)
  on conflict (msisdn_a, cell_id, bucket_start) do update set
    operator_id = coalesce(excluded.operator_id, shield_cdr_buckets.operator_id),
    total_calls = shield_cdr_buckets.total_calls + excluded.total_calls,
    out_calls = shield_cdr_buckets.out_calls + excluded.out_calls,
    in_calls = shield_cdr_buckets.in_calls + excluded.in_calls,
    intl_calls = shield_cdr_buckets.intl_calls + excluded.intl_calls,
    call_in_intl = shield_cdr_buckets.call_in_intl + excluded.call_in_intl,
    premium_calls = shield_cdr_buckets.premium_calls + excluded.premium_calls,
    premium_prefix_calls = shield_cdr_buckets.premium_prefix_calls + excluded.premium_prefix_calls,
    short_calls = shield_cdr_buckets.short_calls + excluded.short_calls,
    flash_calls = shield_cdr_buckets.flash_calls + excluded.flash_calls,
    zero_calls = shield_cdr_buckets.zero_calls + excluded.zero_calls,
    night_calls = shield_cdr_buckets.night_calls + excluded.night_calls,
    out_night_calls = shield_cdr_buckets.out_night_calls + excluded.out_night_calls,
    sum_duration_sec = shield_cdr_buckets.sum_duration_sec + excluded.sum_duration_sec,
    sum_intl_duration_sec = shield_cdr_buckets.sum_intl_duration_sec + excluded.sum_intl_duration_sec;
  return null;
end;
$$;

drop trigger if exists trg_cdr_voice_buckets on cdr_voice;
create trigger trg_cdr_voice_buckets
  after insert on cdr_voice
  referencing new table as new_rows
  for each statement execute function shield_upsert_buckets();
