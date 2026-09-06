-- ══════════════════════════════════════════════════════════════════════
-- SHIELD — Architecture serveur réelle : ingestion CDR + moteur de règles
-- Tout tourne en base (Postgres), déclenché automatiquement à l'insertion
-- d'un CDR — aucune dépendance au navigateur.
-- ══════════════════════════════════════════════════════════════════════

-- 1) Traçabilité des dépôts de fichiers CDR (audit du pipeline d'ingestion)
create table if not exists cdr_ingest_batches (
  id uuid primary key default gen_random_uuid(),
  filename text,
  source text default 'test-upload',
  status text default 'processing', -- processing | done | error
  row_count integer default 0,
  error_count integer default 0,
  error_detail text,
  received_at timestamptz default now(),
  processed_at timestamptz,
  processing_ms integer
);

-- 2) Table de mesure des temps de détection/blocage (transparence totale)
create table if not exists shield_detection_metrics (
  id bigserial primary key,
  batch_id uuid references cdr_ingest_batches(id),
  cdr_id bigint,
  msisdn text,
  cdr_start_time timestamptz,
  rule_id text,
  rule_action text,
  alert_id text,
  alert_created_at timestamptz,
  detection_latency_ms numeric,
  blocking_id text,
  blocking_created_at timestamptz,
  blocking_latency_ms numeric
);
