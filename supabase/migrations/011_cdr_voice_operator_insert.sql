-- ============================================================
-- 011 : Autoriser les opérateurs à insérer leurs propres CDR
-- via le simulateur CDR (RLS était en SELECT-only pour eux)
-- ============================================================

-- Politique INSERT pour les opérateurs : ils peuvent insérer
-- uniquement des CDR avec leur propre operator_id
drop policy if exists cdr_voice_own_operator_insert on cdr_voice;
create policy cdr_voice_own_operator_insert
  on cdr_voice for insert
  with check (
    operator_id is not null
    and operator_id = shield_auth_operator_id()
  );

-- Le staff (superadmin / gfm_analyst) peut déjà tout faire via
-- cdr_voice_staff_all (créée dans 010). Pas besoin de doublon.
