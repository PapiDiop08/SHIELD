# Outils de démo et de contrôle (AAR Telco)

Tous les scripts se lancent depuis la racine du projet et lisent les clés dans `.env` et `.env.server` (jamais commités).

| Script | Rôle |
|---|---|
| `node scripts/demo/sim_test.mjs "$PWD" 6000 raw` | Banc d'essai : rejoue le simulateur avec les règles de la base, affiche règles déclenchées, taux de détection, faux positifs, croisements de familles |
| `node scripts/demo/seed_demo.mjs "$PWD" dry` | Jeu de démo daté sur 7 jours (alertes, blocages, CDR) produit par le vrai moteur. Sans `dry` : insertion en base |
| `node scripts/demo/apply_rule_fixes.mjs "$PWD"` | Applique `rule_fixes.json` aux règles Telco (sauvegarde préalable automatique) |
| `python3 scripts/demo/telco_healthcheck.py` | Contrôle de santé de la base (lecture seule) |
