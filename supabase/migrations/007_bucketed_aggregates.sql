-- ══════════════════════════════════════════════════════════════════════
-- Agrégats pré-calculés par bucket de 5 minutes — pour tenir la charge
-- d'un vrai opérateur (millions de CDR/jour) sans jamais scanner les CDR
-- bruts pour les métriques additives (comptages, ratios, durées).
--
-- Principe : au lieu de recalculer "combien d'appels sur ce numéro dans
-- la dernière heure" en relisant chaque appel, on maintient un mini-total
-- par tranche de 5 min. Pour la fenêtre 1h, on additionne 12 buckets ;
-- pour 24h, 288. Un bucket qui sort de la fenêtre est juste ignoré dans
-- la somme — pas de décrément, pas de dérive, pas de risque de concurrence
-- (chaque UPSERT est atomique côté Postgres).
--
-- Ce qui RESTE sur les CDR bruts (volontairement, voir le message associé) :
-- les comptages de valeurs DISTINCTES (numéros B distincts, pays distincts,
-- max d'appels vers un même B) — un bucket ne peut pas les sommer sans
-- structure spécialisée (HyperLogLog). Avec l'index déjà en place, ces
-- requêtes restent rapides car bornées aux CDR du numéro concerné, jamais
-- à la table entière.
-- ══════════════════════════════════════════════════════════════════════

create table if not exists shield_cdr_buckets (
  msisdn_a text not null,
  cell_id text not null default '_none_',
  bucket_start timestamptz not null,
  operator_id text,
  total_calls int not null default 0,
  out_calls int not null default 0,
  in_calls int not null default 0,
  intl_calls int not null default 0,
  call_in_intl int not null default 0,
  premium_calls int not null default 0,
  premium_prefix_calls int not null default 0,
  short_calls int not null default 0,
  flash_calls int not null default 0,
  zero_calls int not null default 0,
  night_calls int not null default 0,
  out_night_calls int not null default 0,
  sum_duration_sec bigint not null default 0,
  sum_intl_duration_sec bigint not null default 0,
  primary key (msisdn_a, cell_id, bucket_start)
);

create index if not exists idx_shield_buckets_msisdn_time
  on shield_cdr_buckets (msisdn_a, bucket_start desc);
