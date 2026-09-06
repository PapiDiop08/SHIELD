-- Recalcul de shield_compute_metrics() : les métriques additives viennent
-- désormais des buckets (somme de ~300 lignes max, jamais des CDR bruts).
-- Seules 4 métriques restent sur cdr_voice, parce qu'elles comptent des
-- valeurs DISTINCTES (numéros B, pays) ou un écart-type — non sommables
-- sans structure spécialisée (HyperLogLog). Elles restent rapides grâce à
-- l'index (bornées aux CDR de CE numéro, jamais à la table entière).
create or replace function shield_compute_metrics(p_msisdn text, p_asof timestamptz default now())
returns jsonb
language plpgsql
stable
as $$
declare
  m jsonb;
  win24 timestamptz := p_asof - interval '24 hours';
  win2h timestamptz := p_asof - interval '2 hours';
  win1h timestamptz := p_asof - interval '1 hour';
  b24 record; b1h record; b2h record;
  v_cells int; v_cellmax1h int; v_cellmax24h int;
  v_distb int; v_countries int; v_maxsameb int; v_stddev numeric; v_imsi int; v_imei int;
  v_swap30 int; v_swap24 int; v_days_act numeric; v_prefix_bl boolean;
begin
  select coalesce(sum(total_calls),0) total, coalesce(sum(out_calls),0) out_c,
         coalesce(sum(in_calls),0) in_c, coalesce(sum(intl_calls),0) intl_c,
         coalesce(sum(call_in_intl),0) in_intl, coalesce(sum(premium_calls),0) prem_c,
         coalesce(sum(premium_prefix_calls),0) premprefix, coalesce(sum(short_calls),0) short_c,
         coalesce(sum(flash_calls),0) flash_c, coalesce(sum(zero_calls),0) zero_c,
         coalesce(sum(night_calls),0) night_c, coalesce(sum(out_night_calls),0) outnight_c,
         coalesce(sum(sum_duration_sec),0) dur_sum, coalesce(sum(sum_intl_duration_sec),0) intldur_sum
  into b24
  from shield_cdr_buckets where msisdn_a = p_msisdn and bucket_start >= win24 and bucket_start <= p_asof;

  select coalesce(sum(total_calls),0) total from shield_cdr_buckets
    where msisdn_a = p_msisdn and bucket_start >= win1h and bucket_start <= p_asof into b1h;
  select coalesce(sum(out_calls),0) out_c, coalesce(sum(short_calls),0) short_c from shield_cdr_buckets
    where msisdn_a = p_msisdn and bucket_start >= win2h and bucket_start <= p_asof into b2h;

  select count(distinct cell_id) filter (where cell_id <> '_none_'),
         max(c1h.s), max(c24.s)
  into v_cells, v_cellmax1h, v_cellmax24h
  from shield_cdr_buckets sb
  left join lateral (select sum(total_calls) s from shield_cdr_buckets where msisdn_a=p_msisdn and cell_id=sb.cell_id and bucket_start>=win1h and bucket_start<=p_asof) c1h on true
  left join lateral (select sum(total_calls) s from shield_cdr_buckets where msisdn_a=p_msisdn and cell_id=sb.cell_id and bucket_start>=win24 and bucket_start<=p_asof) c24 on true
  where sb.msisdn_a = p_msisdn and sb.bucket_start >= win24 and sb.bucket_start <= p_asof;

  -- Les 4 métriques non-sommables : requête ciblée sur ce seul numéro (index en place)
  select count(distinct msisdn_b), count(distinct country_code_b) filter (where country_code_b is not null),
         stddev(duration_sec), count(distinct imsi), count(distinct imei)
  into v_distb, v_countries, v_stddev, v_imsi, v_imei
  from cdr_voice where msisdn_a = p_msisdn and start_time between win24 and p_asof;

  select max(c) into v_maxsameb from (
    select count(*) c from cdr_voice where msisdn_a = p_msisdn and start_time between win24 and p_asof group by msisdn_b
  ) s;

  select count(*) filter (where swapped_at >= p_asof - interval '30 days'),
         count(*) filter (where swapped_at >= p_asof - interval '24 hours')
  into v_swap30, v_swap24 from sim_swap_history where msisdn = p_msisdn;

  select extract(day from p_asof - min(activated_at)) into v_days_act
  from sim_profiles where msisdn = p_msisdn;

  select exists(
    select 1 from control_lists cl, cdr_voice cv
    where cl.list='blacklist' and cl.type='prefix' and cl.active
      and cv.msisdn_a = p_msisdn and cv.start_time between win24 and p_asof
      and cv.country_code_b is not null and cv.country_code_b = cl.value
  ) into v_prefix_bl;

  m := jsonb_build_object(
    'call_out_count', b24.out_c,
    'call_out_ratio', case when b24.in_c=0 then null else b24.out_c::numeric / b24.in_c end,
    'unique_cells', coalesce(v_cells,0),
    'intl_calls', b24.intl_c,
    'intl_ratio', case when b24.total=0 then 0 else b24.intl_c::numeric / b24.total end,
    'intl_calls_ratio', case when b24.total=0 then 0 else b24.intl_c::numeric / b24.total end,
    'premium_calls', b24.prem_c,
    'short_calls', b24.short_c,
    'short_call_ratio', case when b24.total=0 then 0 else b24.short_c::numeric / b24.total end,
    'avg_duration_sec', case when b24.total=0 then 0 else b24.dur_sum::numeric / b24.total end,
    'duration_std_dev', coalesce(v_stddev,0),
    'distinct_b_24h', coalesce(v_distb,0),
    'distinct_b_numbers', coalesce(v_distb,0),
    'calls_1h', b1h.total,
    'call_out_2h', b2h.out_c,
    'short_calls_1h', b2h.short_c,
    'night_call_ratio', case when b24.total=0 then 0 else b24.night_c::numeric / b24.total end,
    'call_out_night', b24.outnight_c,
    'call_out_night_count', b24.outnight_c,
    'flash_calls', b24.flash_c,
    'zero_sec_calls', b24.zero_c,
    'premium_prefix_calls', b24.premprefix,
    'max_calls_same_b', coalesce(v_maxsameb,0),
    'cell_call_max_1h', coalesce(v_cellmax1h,0),
    'cell_call_max_24h', coalesce(v_cellmax24h,0),
    'is_international', b24.intl_c > 0,
    'avg_intl_duration_sec', case when b24.intl_c=0 then 0 else b24.intldur_sum::numeric / b24.intl_c end,
    'imsi_change_count_24h', greatest(coalesce(v_imsi,1)-1,0),
    'call_in_intl_24h', b24.in_intl,
    'countries_called_count', coalesce(v_countries,0),
    'imei_changed', case when coalesce(v_imei,1) > 1 then 1 else 0 end,
    'sim_swap_count', coalesce(v_swap30,0),
    'sim_swap_24h', coalesce(v_swap24,0),
    'days_since_activation', coalesce(v_days_act, 9999),
    'prefix_blacklist', v_prefix_bl,
    '_computed_at', to_jsonb(p_asof),
    '_source', 'buckets_5min'
  );
  return m;
end;
$$;
