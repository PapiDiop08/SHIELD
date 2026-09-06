-- Index couvrant pour que le recalcul des métriques par MSISDN ne scanne
-- jamais toute la table (indispensable dès que cdr_voice dépasse quelques
-- millions de lignes) : Postgres saute directement aux lignes du MSISDN
-- concerné, triées par temps, au lieu de lire toute la table.
create index if not exists idx_cdr_voice_msisdn_time on cdr_voice (msisdn_a, start_time desc);
create index if not exists idx_cdr_voice_time on cdr_voice (start_time desc);
create index if not exists idx_sim_swap_msisdn_time on sim_swap_history (msisdn, swapped_at desc);
