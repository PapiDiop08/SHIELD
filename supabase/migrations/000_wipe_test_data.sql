-- Nettoyage : on vide les données de fraude générées par l'ancien
-- simulateur client, on garde la config (rules, operators, profiles,
-- sim_profiles, distributors, control_lists, udf_fields).
truncate table shield_detection_metrics, cdr_ingest_batches restart identity;
truncate table cdr_voice restart identity cascade;
truncate table alerts;
truncate table blockings;
truncate table cell_anomalies;
truncate table sim_swap_history restart identity;
truncate table cases;
truncate table complaints;
truncate table audit_logs;
update rules set triggered = 0, blocked = 0;
update operators set detections = 0, blocked = 0;
update control_lists set matches = 0, last_match = null;
