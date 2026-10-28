# AAR Telco

Plateforme de détection de la fraude télécom (SIM Box, IRSF, Wangiri, SIM swap, roaming, spoofing CLI...) éditée par **Global Fraud Management (GFM)**.
Analyse les CDR d'un opérateur, applique 44 règles, génère des alertes, bloque les MSISDN et outille l'investigation.

## Stack

| Couche | Technologie |
|---|---|
| Front | React 18 + Vite (SPA), déployé sur Vercel |
| Base de données | PostgreSQL (aujourd'hui hébergé sur Supabase) avec RLS multi-opérateur |
| Authentification | Supabase Auth (JWT) |
| Moteur de règles | Fonctions SQL (`shield_*`) + évaluation côté front pour le simulateur |
| Ingestion CDR | Serveur SFTP + watcher Python (`sftp/`) qui appellent la RPC `shield_ingest_cdr_batch` |
| IA | Ollama en local (page Analyse IA) |

## Démarrer en local

```bash
npm install
cp .env.example .env        # puis remplir VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run dev                 # http://localhost:5173
npm run build               # build de production dans dist/
```

## Variables d'environnement

| Fichier | Variable | Rôle |
|---|---|---|
| `.env` (front) | `VITE_SUPABASE_URL` | URL de l'API base de données |
| `.env` (front) | `VITE_SUPABASE_ANON_KEY` | Clé **publique** (anon / publishable) |
| `.env.server` (serveur) | `SUPABASE_PROJECT_REF`, `SUPABASE_SECRET_KEY` | Accès serveur pour l'ingestion SFTP |
| `.env.server` (serveur) | `SHIELD_SFTP_USER`, `SHIELD_SFTP_PASSWORD`, `SHIELD_SFTP_PORT` | Compte SFTP partenaire |

Règle absolue : **aucune clé secrète (service_role / secret key) dans une variable `VITE_*` ni dans le code**. Tout ce qui commence par `VITE_` est livré au navigateur. Les modèles sont dans `.env.example` et `.env.server.example`.

## Structure

```
src/
  pages/        écrans (Dashboard, Alerts, Rules, RulesReview, CdrSimulator, Cases, Blockings,
                Lists, Complaints, Cells, Distributors, SimManagement, SimProfile, Operators,
                UDFManager, Reports, FinancialReporting, AIAnalysis, Logs, Admin, Settings...)
  engine/       moteur d'évaluation des règles côté front (simulateur)
  hooks/        accès base (useSupabase.js)
supabase/
  migrations/   migrations SQL du moteur d'ingestion et de détection (001 à 011)
sftp/           serveur SFTP partenaire + watcher d'ingestion
scripts/        générateurs de CDR de test
```

## Base de données

La base est **commune** à AAR Telco et AAR Mobile Money (tables partagées, règles séparées par la colonne `scope` = `telco` ou `mobile_money`).
Le paquet complet (schéma, fonctions, RLS, référentiels, guide d'installation sur AWS) est dans **`database/`** : voir `database/README.md`.

## Méthode de travail (Git)

- `main` = version de référence, déployée automatiquement par Vercel.
- Récupérer les dernières mises à jour : `git pull origin main`.
- Pour une modification : créer une branche (`git checkout -b feature/ma-modif`), pousser, ouvrir une Pull Request vers `main`.
- Toute évolution de la base passe par un **nouveau fichier de migration** numéroté dans `database/migrations/` (jamais de modification manuelle non tracée).
