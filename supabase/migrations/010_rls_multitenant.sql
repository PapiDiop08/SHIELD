-- 010_rls_multitenant.sql
-- RLS multi-tenant stricte : un operateur (operator_id) ne voit JAMAIS les
-- donnees d'un autre operateur. Le personnel GFM (profiles.operator_id IS NULL)
-- voit tout (superviseur cross-operateur, superadmin, analystes internes).
-- Un CDR/alerte/blocage sans operator_id (source SFTP non mappee) n'est
-- JAMAIS visible cote operateur, uniquement dans les stats superadmin.

-- ============================================================
-- 1. Colonnes operator_id manquantes
-- ============================================================
alter table cdr_ingest_batches add column if not exists operator_id text references operators(id);
alter table cdr_ingest_batches add column if not exists ingest_source text;

alter table rules add column if not exists operator_id text references operators(id);
alter table control_lists add column if not exists operator_id text references operators(id);
alter table cell_anomalies add column if not exists operator_id text references operators(id);
alter table sim_swap_history add column if not exists operator_id text references operators(id);
alter table shield_detection_metrics add column if not exists operator_id text references operators(id);

-- backfill best-effort a partir des colonnes texte existantes (nom d'operateur)
update rules r set operator_id = o.id from operators o where r.operator_id is null and r.operator = o.name;
update control_lists c set operator_id = o.id from operators o where c.operator_id is null and c.operator = o.name;
update cell_anomalies c set operator_id = o.id from operators o where c.operator_id is null and c.operator = o.name;
update sim_swap_history s set operator_id = sp.operator_id from sim_profiles sp where s.operator_id is null and s.msisdn = sp.msisdn;

create index if not exists idx_cdr_ingest_batches_operator on cdr_ingest_batches(operator_id);

-- ============================================================
-- 2. Table de mapping "source d'ingestion -> operateur"
--    C'est ICI qu'on decide a quel operateur appartient un CDR,
--    JAMAIS a partir d'une colonne envoyee par le partenaire lui-meme
--    (un partenaire ne peut pas se faire passer pour un autre).
-- ============================================================
create table if not exists ingest_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text unique not null,        -- ex: identifiant SFTP du partenaire
  label text,
  operator_id text references operators(id),  -- null = non mappe -> orphelin
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
comment on table ingest_sources is 'Mappe chaque canal d''ingestion (utilisateur SFTP, cle API future) a un operator_id. Le fichier lui-meme ne contient jamais cette info.';

insert into ingest_sources (source_key, label, operator_id, notes)
values ('partner_test', 'SFTP test local (simulation)', 'op1', 'Compte SFTP de simulation - mappe a Partner SN pour les tests de bout en bout')
on conflict (source_key) do nothing;

-- ============================================================
-- 3. Fonctions d'aide RLS (SECURITY DEFINER, contournent la RLS de
--    profiles pour eviter toute recursion, mais ne renvoient que
--    l'operator_id du user courant - aucune fuite entre comptes)
-- ============================================================
create or replace function shield_auth_operator_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select operator_id from profiles where id = auth.uid()
$$;

create or replace function shield_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select operator_id is null from profiles where id = auth.uid()), false)
$$;

grant execute on function shield_auth_operator_id() to authenticated;
grant execute on function shield_is_staff() to authenticated;

-- ============================================================
-- 4. Reecriture de l'ingestion : operator_id vient TOUJOURS du
--    mapping source -> operateur, jamais du payload du partenaire.
-- ============================================================
create or replace function shield_ingest_cdr_batch(p_rows jsonb, p_filename text, p_source text default 'test-upload')
returns jsonb
language plpgsql
as $$
declare
  v_batch_id uuid;
  v_started timestamptz := clock_timestamp();
  v_operator_id text;
  v_row_count int;
  v_error_count int := 0;
  v_error_detail text;
begin
  select operator_id into v_operator_id
  from ingest_sources
  where source_key = p_source and active;

  insert into cdr_ingest_batches (filename, source, ingest_source, status, operator_id, received_at)
  values (p_filename, p_source, p_source, 'processing', v_operator_id, now())
  returning id into v_batch_id;

  perform set_config('shield.current_batch_id', v_batch_id::text, true);

  if v_operator_id is null then
    v_error_detail := 'source d''ingestion "' || p_source || '" non mappee a un operateur - lot ingere pour audit uniquement, invisible cote operateur';
  end if;

  with ins as (
    insert into cdr_voice (
      msisdn_a, msisdn_b, imsi, imei, cell_id, duration_sec, start_time,
      call_type, is_international, is_premium, country_code_b, direction,
      network_type, operator_id
    )
    select
      x.msisdn_a, x.msisdn_b, x.imsi, x.imei, x.cell_id, x.duration_sec, x.start_time,
      x.call_type, x.is_international, x.is_premium, x.country_code_b, x.direction,
      x.network_type, v_operator_id
    from jsonb_to_recordset(p_rows) as x(
      msisdn_a text, msisdn_b text, imsi text, imei text, cell_id text,
      duration_sec int, start_time timestamptz, call_type text,
      is_international boolean, is_premium boolean, country_code_b text,
      direction text, network_type text
    )
    returning 1
  )
  select count(*) into v_row_count from ins;

  update cdr_ingest_batches
  set status = 'done',
      row_count = v_row_count,
      error_count = v_error_count,
      error_detail = v_error_detail,
      processed_at = clock_timestamp(),
      processing_ms = extract(epoch from (clock_timestamp() - v_started)) * 1000
  where id = v_batch_id;

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'rows_ingested', v_row_count,
    'operator_id', v_operator_id,
    'processing_ms', extract(epoch from (clock_timestamp() - v_started)) * 1000
  );
exception when others then
  update cdr_ingest_batches
  set status = 'error', error_detail = sqlerrm, processed_at = clock_timestamp()
  where id = v_batch_id;
  raise;
end;
$$;

-- Seul le pipeline serveur (service_role) peut ingerer des CDR bruts.
revoke execute on function shield_ingest_cdr_batch(jsonb, text, text) from anon, authenticated, public;
grant execute on function shield_ingest_cdr_batch(jsonb, text, text) to service_role;

-- ============================================================
-- 5. Le moteur de regles n'evalue jamais un CDR orphelin
--    (operator_id null) : pas d'alerte, pas de blocage crees pour
--    du trafic dont on ne sait pas a qui il appartient.
-- ============================================================
create or replace function shield_evaluate_msisdn(
  p_msisdn text, p_operator_id text, p_batch_id uuid, p_cdr_id bigint, p_cdr_time timestamptz
)
returns void
language plpgsql
as $$
declare
  r record;
  v_metrics jsonb;
  v_alert_id text;
  v_blocking_id text;
  v_alert_ts timestamptz;
  v_block_ts timestamptz;
begin
  if p_operator_id is null then
    return; -- CDR orphelin (source non mappee) : jamais evalue, jamais alerte
  end if;

  v_metrics := shield_compute_metrics(p_msisdn, p_cdr_time);

  for r in
    select * from rules
    where active
      and scope in ('telco', 'global')
      and shield_rule_is_evaluable(conditions)
  loop
    if shield_evaluate_rule(r.conditions, v_metrics) then
      v_alert_id := 'AL-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
      v_alert_ts := clock_timestamp();
      insert into alerts (
        id, msisdn, operator, operator_id, status, severity, fraud_type, type,
        reason, conditions, scope, date, created_at, updated_at
      ) values (
        v_alert_id, p_msisdn,
        (select name from operators where id = p_operator_id), p_operator_id,
        case when r.action = 'block' then 'blocked' else 'open' end,
        r.severity, r.name, r.name, r.description, r.conditions, r.scope,
        current_date, v_alert_ts, v_alert_ts
      );

      update rules set triggered = coalesce(triggered, 0) + 1 where id = r.id;

      if r.action = 'block' then
        v_blocking_id := 'BLK-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
        v_block_ts := clock_timestamp();
        insert into blockings (id, msisdn, reason, operator, operator_id, active, date, source, created_at)
        values (
          v_blocking_id, p_msisdn, r.name,
          (select name from operators where id = p_operator_id), p_operator_id,
          true, current_date::text, 'auto-rule:' || r.id, v_block_ts
        );
        update rules set blocked = coalesce(blocked, 0) + 1 where id = r.id;
      end if;

      insert into shield_detection_metrics (
        batch_id, cdr_id, msisdn, cdr_start_time, rule_id, rule_action,
        alert_id, alert_created_at, detection_latency_ms,
        blocking_id, blocking_created_at, blocking_latency_ms, operator_id
      ) values (
        p_batch_id, p_cdr_id, p_msisdn, p_cdr_time, r.id, r.action,
        v_alert_id, v_alert_ts, extract(epoch from (v_alert_ts - p_cdr_time)) * 1000,
        v_blocking_id, v_block_ts,
        case when v_blocking_id is not null then extract(epoch from (v_block_ts - v_alert_ts)) * 1000 else null end,
        p_operator_id
      );
    end if;
  end loop;
end;
$$;

-- ============================================================
-- 6. Le trigger d'insertion CDR doit desormais lire operator_id
--    depuis la ligne CDR elle-meme (deja stampee par l'ingestion,
--    jamais par le fichier du partenaire) et le transmettre.
-- ============================================================
create or replace function shield_cdr_after_insert()
returns trigger
language plpgsql
as $$
declare
  v_batch_id uuid := nullif(current_setting('shield.current_batch_id', true), '')::uuid;
  r record;
begin
  for r in
    select distinct on (msisdn_a) msisdn_a, operator_id, id, start_time
    from new_rows
    order by msisdn_a, start_time desc
  loop
    perform shield_evaluate_msisdn(r.msisdn_a, r.operator_id, v_batch_id, r.id, r.start_time);
  end loop;
  return null;
end;
$$;

-- ============================================================
-- 7. Vue stats superadmin : jamais filtree par operateur, montre
--    exactement les lots recus, les manques et les problemes.
-- ============================================================
create or replace view shield_cdr_ingest_stats
with (security_invoker = true) as
select
  b.id as batch_id,
  b.filename,
  b.source,
  b.operator_id,
  o.name as operator_name,
  b.status,
  b.row_count,
  b.error_count,
  b.error_detail,
  (b.operator_id is null) as orphan,
  b.received_at,
  b.processed_at,
  b.processing_ms
from cdr_ingest_batches b
left join operators o on o.id = b.operator_id
order by b.received_at desc;

create or replace view shield_cdr_ingest_stats_summary
with (security_invoker = true) as
select
  coalesce(operator_id, '(non mappe)') as operator_id,
  count(*) as batches,
  sum(row_count) as total_rows,
  sum(error_count) as total_errors,
  sum(case when operator_id is null then coalesce(row_count,0) else 0 end) as orphan_rows,
  max(received_at) as last_received_at
from cdr_ingest_batches
group by coalesce(operator_id, '(non mappe)');

-- ============================================================
-- 8. RLS - activation stricte (ENABLE + FORCE) sur toutes les
--    tables sensibles. service_role (pipeline serveur) contourne
--    automatiquement la RLS et n'est pas affecte.
-- ============================================================
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'cdr_voice','alerts','blockings','cdr_ingest_batches','sim_profiles',
    'rules','control_lists','cell_anomalies','sim_swap_history','cases',
    'complaints','profiles','shield_cdr_buckets','shield_detection_metrics'
  ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- profiles : chacun voit toujours sa propre ligne ; le staff (operator_id
-- null) voit tout le monde ; un user d'operateur voit son propre operateur.
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for select using (id = auth.uid());
drop policy if exists profiles_staff_all on profiles;
create policy profiles_staff_all on profiles for all using (shield_is_staff());
drop policy if exists profiles_same_operator on profiles;
create policy profiles_same_operator on profiles for select using (
  operator_id is not null and operator_id = shield_auth_operator_id()
);

-- Tables "donnees operateur" standard : select strictement filtre par
-- operator_id, jamais de ligne operator_id null visible cote operateur.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'cdr_voice','alerts','blockings','sim_profiles','control_lists',
    'cell_anomalies','sim_swap_history','cases','complaints',
    'shield_cdr_buckets','shield_detection_metrics'
  ])
  loop
    execute format('drop policy if exists %I_staff_all on %I', t, t);
    execute format('create policy %I_staff_all on %I for all using (shield_is_staff())', t, t);
    execute format('drop policy if exists %I_own_operator on %I', t, t);
    execute format(
      'create policy %I_own_operator on %I for select using (operator_id is not null and operator_id = shield_auth_operator_id())',
      t, t
    );
  end loop;
end $$;

-- Les operateurs peuvent agir (update) sur LEURS propres alertes / cas /
-- blocages / plaintes (statut, assignation), jamais sur ceux d'un autre.
drop policy if exists alerts_own_operator_update on alerts;
create policy alerts_own_operator_update on alerts for update using (
  operator_id is not null and operator_id = shield_auth_operator_id()
);
drop policy if exists cases_own_operator_update on cases;
create policy cases_own_operator_update on cases for update using (
  operator_id is not null and operator_id = shield_auth_operator_id()
);
drop policy if exists complaints_own_operator_update on complaints;
create policy complaints_own_operator_update on complaints for update using (
  operator_id is not null and operator_id = shield_auth_operator_id()
);
drop policy if exists blockings_own_operator_update on blockings;
create policy blockings_own_operator_update on blockings for update using (
  operator_id is not null and operator_id = shield_auth_operator_id()
);

-- rules : les regles "global" restent visibles par tous (elles ne
-- contiennent aucune donnee d'un operateur, seulement une logique de
-- detection) ; les regles specifiques a un operateur restent privees.
drop policy if exists rules_staff_all on rules;
create policy rules_staff_all on rules for all using (shield_is_staff());
drop policy if exists rules_visible on rules;
create policy rules_visible on rules for select using (
  scope = 'global'
  or (operator_id is not null and operator_id = shield_auth_operator_id())
);

-- cdr_ingest_batches : reserve au staff GFM (superviseur/superadmin/
-- analystes internes). Un operateur n'a pas a voir le detail des lots
-- d'ingestion bruts, seulement ses propres CDR/alertes deja traites.
drop policy if exists cdr_ingest_batches_staff_only on cdr_ingest_batches;
create policy cdr_ingest_batches_staff_only on cdr_ingest_batches for all using (shield_is_staff());

-- operators : chacun voit uniquement sa propre fiche operateur ; le
-- staff voit tout.
alter table operators enable row level security;
alter table operators force row level security;
drop policy if exists operators_staff_all on operators;
create policy operators_staff_all on operators for all using (shield_is_staff());
drop policy if exists operators_self on operators;
create policy operators_self on operators for select using (id = shield_auth_operator_id());
