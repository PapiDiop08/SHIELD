-- 4) Champs réellement calculables aujourd'hui (whitelist honnête).
-- Une règle dont une condition référence un champ hors de cette liste est
-- automatiquement écartée (jamais évaluée à tort) et comptée à part.
create or replace function shield_computable_fields()
returns text[] language sql immutable as $$
  select array['call_out_count','call_out_ratio','unique_cells','intl_calls','intl_ratio',
    'intl_calls_ratio','premium_calls','short_calls','short_call_ratio','avg_duration_sec',
    'duration_std_dev','distinct_b_24h','distinct_b_numbers','calls_1h','call_out_2h',
    'short_calls_1h','night_call_ratio','call_out_night','call_out_night_count','flash_calls',
    'zero_sec_calls','premium_prefix_calls','max_calls_same_b','cell_call_max_1h',
    'cell_call_max_24h','is_international','avg_intl_duration_sec','imsi_change_count_24h',
    'call_in_intl_24h','countries_called_count','imei_changed','sim_swap_count','sim_swap_24h',
    'days_since_activation','prefix_blacklist'];
$$;

create or replace function shield_eval_condition(cond jsonb, metrics jsonb)
returns boolean language plpgsql immutable as $$
declare
  fld text := cond->>'field';
  cmp text := cond->>'comparator';
  raw text := cond->>'value';
  mval jsonb;
  mnum numeric;
  a numeric; b numeric;
begin
  if fld is null or not (metrics ? fld) then return null; end if;
  mval := metrics->fld;
  if cmp = 'match' or cmp = 'in' then
    return null; -- listes de référence non branchées (irsf_countries, wangiri_prefixes...)
  end if;
  if jsonb_typeof(mval) = 'boolean' then
    return case when raw in ('true','1') then (mval)::text::boolean = true
                when raw in ('false','0') then (mval)::text::boolean = false
                else null end;
  end if;
  mnum := (mval)::text::numeric;
  case cmp
    when '>' then return mnum > raw::numeric;
    when '>=' then return mnum >= raw::numeric;
    when '<' then return mnum < raw::numeric;
    when '<=' then return mnum <= raw::numeric;
    when '=' then return mnum = raw::numeric;
    when '==' then return mnum = raw::numeric;
    when 'between' then
      a := split_part(raw, ',', 1)::numeric; b := split_part(raw, ',', 2)::numeric;
      return mnum between a and b;
    else return null;
  end case;
exception when others then return null;
end;
$$;

create or replace function shield_rule_is_evaluable(conditions jsonb)
returns boolean language sql immutable as $$
  select not exists (
    select 1 from jsonb_array_elements(conditions) c
    where (c->>'field') is null or not ((c->>'field') = any(shield_computable_fields()))
       or (c->>'comparator') in ('match','in')
  );
$$;

create or replace function shield_evaluate_rule(rule_conditions jsonb, metrics jsonb)
returns boolean language plpgsql immutable as $$
declare
  cond jsonb; result boolean; logic text; i int := 0;
begin
  if jsonb_array_length(rule_conditions) = 0 then return false; end if;
  for cond in select * from jsonb_array_elements(rule_conditions) loop
    i := i + 1;
    if i = 1 then
      result := shield_eval_condition(cond, metrics);
    else
      logic := upper(coalesce(cond->>'logic','ET'));
      if logic = 'OU' then result := coalesce(result,false) or coalesce(shield_eval_condition(cond, metrics),false);
      else result := coalesce(result,false) and coalesce(shield_eval_condition(cond, metrics),false);
      end if;
    end if;
  end loop;
  return coalesce(result,false);
end;
$$;
