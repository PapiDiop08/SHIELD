-- ============================================================
-- SHIELD — Diagnostic + Fix visibilité Supabase
-- Coller dans https://supabase.com/dashboard/project/isqprbqxtscjihqqhjqm/editor
-- ============================================================

-- 1. CHECK — Voir si des données existent (sans RLS)
-- Ces requêtes passent en service_role depuis le dashboard, donc elles voient tout.
SELECT 'operators' as tbl, count(*) FROM operators
UNION ALL SELECT 'profiles', count(*) FROM profiles
UNION ALL SELECT 'alerts', count(*) FROM alerts
UNION ALL SELECT 'rules', count(*) FROM rules
UNION ALL SELECT 'blockings', count(*) FROM blockings;

-- 2. CHECK — Voir les policies RLS actives
SELECT schemaname, tablename, rowsecurity, forcerowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('operators','profiles','alerts','rules','blockings','cases','control_lists')
ORDER BY tablename;

-- 3. CHECK — Voir les profils utilisateurs (auth.users + profiles)
SELECT au.id, au.email, p.name, p.role, p.operator_id,
       CASE WHEN p.operator_id IS NULL THEN 'STAFF (voit tout)' ELSE 'Opérateur scopé' END as access
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
ORDER BY au.created_at;

-- ============================================================
-- SI les données existent mais que l'app ne les affiche pas :
-- → Le problème est que l'utilisateur connecté n'a pas de profil
--   avec operator_id IS NULL (requis pour être "staff" et tout voir).
-- FIX : mettre à jour le profil de l'user principal pour lui donner accès staff
-- ============================================================

-- OPTION A — Passer un user en staff (remplacer l'email)
-- UPDATE profiles SET operator_id = NULL, role = 'superadmin'
-- WHERE email = 'ton-email@example.com';

-- OPTION B — Désactiver RLS temporairement (pour tests uniquement)
-- ALTER TABLE operators DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE alerts DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE rules DISABLE ROW LEVEL SECURITY;

-- OPTION C — Si le profil n'existe pas, le créer
-- INSERT INTO profiles (id, email, name, role, operator_id, active)
-- SELECT id, email, email, 'superadmin', NULL, true
-- FROM auth.users
-- WHERE email = 'ton-email@example.com'
-- ON CONFLICT (id) DO UPDATE SET role = 'superadmin', operator_id = NULL;
