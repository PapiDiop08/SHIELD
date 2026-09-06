-- 6) Déclencheur automatique : dès qu'un CDR est inséré, on évalue les
-- règles pour son MSISDN — 100% serveur, aucun navigateur requis.
create or replace function shield_cdr_after_insert()
returns trigger language plpgsql as $$
declare r record; v_batch uuid; begin
  v_batch := nullif(current_setting('shield.current_batch_id', true), '')::uuid;
  for r in select distinct on (msisdn_a) msisdn_a, operator_id, id, start_time
           from new_rows order by msisdn_a, start_time desc
  loop
    perform shield_evaluate_msisdn(r.msisdn_a, r.operator_id, v_batch, r.id, r.start_time);
  end loop;
  return null;
end; $$;

drop trigger if exists trg_cdr_voice_evaluate on cdr_voice;
create trigger trg_cdr_voice_evaluate
  after insert on cdr_voice
  referencing new table as new_rows
  for each statement execute function shield_cdr_after_insert();

-- 7) Point d'entrée d'ingestion — c'est ici qu'un vrai fichier partenaire
-- (CSV/SFTP) atterrira demain. Aujourd'hui : dépôt de test via RPC, mais
-- le chemin est identique à celui qu'empruntera un flux réel.
create or replace function shield_ingest_cdr_batch(p_rows jsonb, p_filename text, p_source text default 'test-upload')
returns jsonb language plpgsql as $$
declare
  v_batch_id uuid;
  v_t0 timestamptz := clock_timestamp();
  v_count int;
begin
  insert into cdr_ingest_batches (filename, source, status, row_count)
  values (p_filename, p_source, 'processing', jsonb_array_length(p_rows))
  returning id into v_batch_id;

  perform set_config('shield.current_batch_id', v_batch_id::text, true);

  insert into cdr_voice (msisdn_a, msisdn_b, imsi, imei, cell_id, duration_sec,
    start_time, call_type, is_international, is_premium, country_code_b, operator_id, direction, network_type)
  select x.msisdn_a, x.msisdn_b, x.imsi, x.imei, x.cell_id, x.duration_sec,
         coalesce(x.start_time, now()), coalesce(x.call_type,'OUT'), coalesce(x.is_international,false),
         coalesce(x.is_premium,false), x.country_code_b, x.operator_id, coalesce(x.direction,'MO'), x.network_type
  from jsonb_to_recordset(p_rows) as x(
    msisdn_a text, msisdn_b text, imsi text, imei text, cell_id text, duration_sec int,
    start_time timestamptz, call_type text, is_international boolean, is_premium boolean,
    country_code_b text, operator_id text, direction text, network_type text
  );
  get diagnostics v_count = row_count;

  update cdr_ingest_batches set status='done', processed_at=clock_timestamp(),
    row_count = v_count, processing_ms = extract(epoch from (clock_timestamp()-v_t0))*1000
  where id = v_batch_id;

  return jsonb_build_object('batch_id', v_batch_id, 'rows_ingested', v_count,
    'processing_ms', extract(epoch from (clock_timestamp()-v_t0))*1000);
exception when others then
  update cdr_ingest_batches set status='error', error_detail = sqlerrm, processed_at = clock_timestamp()
  where id = v_batch_id;
  raise;
end;
$$;

grant execute on function shield_ingest_cdr_batch(jsonb, text, text) to anon, authenticated, service_role;
