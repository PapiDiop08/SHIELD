-- 5) Évaluation réelle des règles pour un MSISDN donné, déclenchée par
-- l'insertion de CDR — écrit dans alerts/blockings, mesure les latences.
create or replace function shield_evaluate_msisdn(p_msisdn text, p_operator_id text, p_batch_id uuid, p_cdr_id bigint, p_cdr_time timestamptz)
returns void language plpgsql as $$
declare
  metrics jsonb;
  r record;
  new_alert_id text;
  new_block_id text;
  t_alert timestamptz;
  t_block timestamptz;
  op_name text;
begin
  metrics := shield_compute_metrics(p_msisdn, now());
  select name into op_name from operators where id = p_operator_id;

  for r in
    select * from rules
    where active and scope in ('telco','global')
      and shield_rule_is_evaluable(conditions)
  loop
    if shield_evaluate_rule(r.conditions, metrics) then
      new_alert_id := 'AL-' || to_char(now(),'YYYYMMDDHH24MISSMS') || '-' || substr(md5(random()::text),1,4);
      t_alert := clock_timestamp();
      insert into alerts (id, msisdn, operator, operator_id, status, score,
        severity, fraud_type, type, date, reason, conditions, created_at, scope)
      values (new_alert_id, p_msisdn, op_name, p_operator_id, 'open',
        case r.severity when 'critical' then 95 when 'high' then 80 when 'medium' then 55 else 30 end,
        r.severity, r.name, r.action, current_date,
        'Règle « '||r.name||' » déclenchée automatiquement par le moteur serveur',
        r.conditions, t_alert, r.scope);

      update rules set triggered = coalesce(triggered,0) + 1 where id = r.id;

      insert into shield_detection_metrics(batch_id, cdr_id, msisdn, cdr_start_time, rule_id, rule_action,
        alert_id, alert_created_at, detection_latency_ms)
      values (p_batch_id, p_cdr_id, p_msisdn, p_cdr_time, r.id, r.action,
        new_alert_id, t_alert, extract(epoch from (t_alert - p_cdr_time)) * 1000);

      if r.action = 'block' then
        new_block_id := 'BL-' || to_char(now(),'YYYYMMDDHH24MISSMS') || '-' || substr(md5(random()::text),1,4);
        t_block := clock_timestamp();
        insert into blockings (id, msisdn, reason, operator, operator_id, active, date, source, auto_flagged, created_at)
        values (new_block_id, p_msisdn, 'Blocage automatique — '||r.name, op_name, p_operator_id,
          true, current_date::text, 'system', jsonb_build_array(r.id), t_block);

        update alerts set status = 'blocked', updated_at = t_block where id = new_alert_id;
        update rules set blocked = coalesce(blocked,0) + 1 where id = r.id;

        update shield_detection_metrics set blocking_id = new_block_id, blocking_created_at = t_block,
          blocking_latency_ms = extract(epoch from (t_block - t_alert)) * 1000
        where alert_id = new_alert_id;
      end if;
    end if;
  end loop;
end;
$$;
