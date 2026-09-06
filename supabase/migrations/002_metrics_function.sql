-- 3) Calcul des métriques réelles à partir des CDR bruts (fenêtre glissante)
-- N'invente RIEN : chaque métrique est calculée depuis une donnée réelle
-- (cdr_voice, sim_swap_history, control_lists, sim_profiles). Les métriques
-- nécessitant une source non encore branchée (Mobile Money, PBX, billing,
-- signalisation) ne sont PAS calculées — elles resteront absentes du jsonb,
-- ce qui empêche mécaniquement toute règle qui en dépend de se déclencher.
create or replace function shield_compute_metrics(p_msisdn text, p_asof timestamptz default now())
returns jsonb
language plpgsql
stable
as $$
declare
  m jsonb;
  v_total_24h int; v_out_24h int; v_in_24h int; v_intl int; v_prem int;
  v_short int; v_avgdur numeric; v_stddev numeric; v_cells int; v_distb int;
  v_calls1h int; v_out2h int; v_short1h int; v_night int; v_out_night int;
  v_flash int; v_zero int; v_premprefix int; v_maxsameb int;
  v_cellmax1h int; v_cellmax24h int; v_isintl boolean; v_avgintldur numeric;
  v_imsichg int; v_callinintl int; v_countries int; v_imeichg int;
  v_swap30 int; v_swap24 int; v_days_act numeric; v_prefix_bl boolean;
  win_start timestamptz := p_asof - interval '24 hours';
begin
  select count(*), count(*) filter (where call_type='OUT'), count(*) filter (where call_type='IN'),
         count(*) filter (where is_international), count(*) filter (where is_premium),
         count(*) filter (where duration_sec < 3), avg(duration_sec), stddev(duration_sec),
         count(distinct cell_id), count(distinct msisdn_b),
         count(*) filter (where start_time >= p_asof - interval '1 hour'),
         count(*) filter (where call_type='OUT' and start_time >= p_asof - interval '2 hours'),
         count(*) filter (where duration_sec < 3 and start_time >= p_asof - interval '1 hour'),
         count(*) filter (where extract(hour from start_time) >= 22 or extract(hour from start_time) < 6),
         count(*) filter (where call_type='OUT' and (extract(hour from start_time) >= 22 or extract(hour from start_time) < 6)),
         count(*) filter (where duration_sec <= 1),
         count(*) filter (where duration_sec = 0),
         count(*) filter (where is_premium and country_code_b in ('881','882','883')),
         bool_or(is_international), avg(duration_sec) filter (where is_international),
         count(distinct imsi), count(*) filter (where call_type='IN' and is_international),
         count(distinct country_code_b) filter (where country_code_b is not null),
         count(distinct imei)
  into v_total_24h, v_out_24h, v_in_24h, v_intl, v_prem, v_short, v_avgdur, v_stddev,
       v_cells, v_distb, v_calls1h, v_out2h, v_short1h, v_night, v_out_night,
       v_flash, v_zero, v_premprefix, v_isintl, v_avgintldur, v_imsichg, v_callinintl,
       v_countries, v_imeichg
  from cdr_voice where msisdn_a = p_msisdn and start_time between win_start and p_asof;

  select max(c) into v_maxsameb from (
    select count(*) c from cdr_voice where msisdn_a = p_msisdn and start_time between win_start and p_asof group by msisdn_b
  ) s;
  select max(c) into v_cellmax24h from (
    select count(*) c from cdr_voice where msisdn_a = p_msisdn and start_time between win_start and p_asof group by cell_id
  ) s;
  select max(c) into v_cellmax1h from (
    select count(*) c from cdr_voice where msisdn_a = p_msisdn and start_time >= p_asof - interval '1 hour' group by cell_id
  ) s;

  select count(*) filter (where swapped_at >= p_asof - interval '30 days'),
         count(*) filter (where swapped_at >= p_asof - interval '24 hours')
  into v_swap30, v_swap24
  from sim_swap_history where msisdn = p_msisdn;

  select extract(day from p_asof - min(activated_at)) into v_days_act
  from sim_profiles where msisdn = p_msisdn;

  select exists(
    select 1 from control_lists cl, cdr_voice cv
    where cl.list='blacklist' and cl.type='prefix' and cl.active
      and cv.msisdn_a = p_msisdn and cv.start_time between win_start and p_asof
      and cv.country_code_b is not null and cv.country_code_b = cl.value
  ) into v_prefix_bl;

  m := jsonb_build_object(
    'call_out_count', coalesce(v_out_24h,0),
    'call_out_ratio', case when coalesce(v_in_24h,0)=0 then null else v_out_24h::numeric / v_in_24h end,
    'unique_cells', coalesce(v_cells,0),
    'intl_calls', coalesce(v_intl,0),
    'intl_ratio', case when coalesce(v_total_24h,0)=0 then 0 else v_intl::numeric / v_total_24h end,
    'intl_calls_ratio', case when coalesce(v_total_24h,0)=0 then 0 else v_intl::numeric / v_total_24h end,
    'premium_calls', coalesce(v_prem,0),
    'short_calls', coalesce(v_short,0),
    'short_call_ratio', case when coalesce(v_total_24h,0)=0 then 0 else v_short::numeric / v_total_24h end,
    'avg_duration_sec', coalesce(v_avgdur,0),
    'duration_std_dev', coalesce(v_stddev,0),
    'distinct_b_24h', coalesce(v_distb,0),
    'distinct_b_numbers', coalesce(v_distb,0),
    'calls_1h', coalesce(v_calls1h,0),
    'call_out_2h', coalesce(v_out2h,0),
    'short_calls_1h', coalesce(v_short1h,0),
    'night_call_ratio', case when coalesce(v_total_24h,0)=0 then 0 else v_night::numeric / v_total_24h end,
    'call_out_night', coalesce(v_out_night,0),
    'call_out_night_count', coalesce(v_out_night,0),
    'flash_calls', coalesce(v_flash,0),
    'zero_sec_calls', coalesce(v_zero,0),
    'premium_prefix_calls', coalesce(v_premprefix,0),
    'max_calls_same_b', coalesce(v_maxsameb,0),
    'cell_call_max_1h', coalesce(v_cellmax1h,0),
    'cell_call_max_24h', coalesce(v_cellmax24h,0),
    'is_international', coalesce(v_isintl,false),
    'avg_intl_duration_sec', coalesce(v_avgintldur,0),
    'imsi_change_count_24h', greatest(coalesce(v_imsichg,1)-1,0),
    'call_in_intl_24h', coalesce(v_callinintl,0),
    'countries_called_count', coalesce(v_countries,0),
    'imei_changed', case when coalesce(v_imeichg,1) > 1 then 1 else 0 end,
    'sim_swap_count', coalesce(v_swap30,0),
    'sim_swap_24h', coalesce(v_swap24,0),
    'days_since_activation', coalesce(v_days_act, 9999),
    'prefix_blacklist', v_prefix_bl,
    '_computed_at', to_jsonb(p_asof)
  );
  return m;
end;
$$;
