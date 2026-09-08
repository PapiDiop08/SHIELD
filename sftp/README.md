# SHIELD — SFTP de test (dépôt CDR partenaire)

Serveur SFTP autonome (aucun droit admin requis, aucun réglage système
touché) qui simule exactement le canal qu'un vrai opérateur utilisera :
dépôt de fichier → ingestion automatique → moteur de règles → alertes/blocages.

## Connexion

- Hôte : `localhost` (ou l'IP de ce Mac si testé depuis un autre appareil)
- Port : `2222`
- Utilisateur : `partner_test`
- Mot de passe : `ShieldPartner2026!` (modifiable via la variable d'env `SHIELD_SFTP_PASSWORD` avant de relancer `sftp_server.py`)
- Dossier accessible : uniquement `sftp/incoming/` (le partenaire ne voit rien d'autre)

Avec un client graphique (FileZilla, Cyberduck) : Protocole = SFTP, mêmes
identifiants. Avec la ligne de commande :

```
sftp -P 2222 partner_test@localhost
put mon_fichier_cdr.csv
```

## Format de fichier attendu (CSV, en-têtes obligatoires)

Colonne obligatoire : `msisdn_a`. Toutes les autres sont optionnelles
(valeurs par défaut appliquées si absentes) :

```
msisdn_a,msisdn_b,imsi,imei,cell_id,duration_sec,start_time,call_type,is_international,is_premium,country_code_b,operator_id,direction,network_type
221771112233,33612345678,608011234567890,356938035643809,CELL-01,25,2026-09-08T10:00:00Z,OUT,true,false,33,op1,MO,2G
```

## Ce qui se passe automatiquement

1. Le fichier arrive dans `sftp/incoming/`.
2. Le watcher (`watcher.py`, tourne en continu) le détecte en ≤2 secondes.
3. Il parse le CSV, appelle `shield_ingest_cdr_batch` (le vrai pipeline serveur).
4. Le fichier est déplacé vers `sftp/processed/` (succès) ou `sftp/error/` (échec, avec le détail dans `watcher.log`).
5. Les alertes/blocages apparaissent immédiatement dans l'app (table `alerts`/`blockings`), aucune action manuelle.

## Gérer les processus

```bash
# statut
ps aux | grep -E "sftp_server|watcher.py"

# logs en direct
tail -f sftp/sftp_server.log
tail -f sftp/watcher.log

# redémarrer
pkill -f sftp_server.py; pkill -f "sftp/watcher.py"
source .sftp-venv/bin/activate
nohup python sftp/sftp_server.py > sftp/sftp_server.log 2>&1 & disown
nohup python sftp/watcher.py > sftp/watcher_stdout.log 2>&1 & disown
```

## Générer un fichier de test

```bash
source .sftp-venv/bin/activate
python scripts/gen_test_cdr.py   # crée test_cdr_simbox.csv (350 CDR, profil SIM Box)
```

## Limites connues (honnêteté, pas de bug caché)

- Ce serveur écoute sur ce Mac uniquement. Pour qu'un vrai partenaire distant
  s'y connecte depuis internet, il faudra soit l'héberger sur un serveur
  cloud avec IP publique, soit ouvrir un tunnel (ex. ngrok) — pas fait ici
  volontairement, car ça exposerait le Mac sur internet sans y avoir réfléchi.
- Mot de passe unique partagé pour l'instant (pas encore un compte par
  partenaire/opérateur) — à faire avant tout vrai partenaire externe.
- Pas de reprise automatique au redémarrage du Mac (le LaunchAgent macOS a
  été tenté mais échoue dans cet environnement distant — à relancer
  manuellement après un redémarrage, ou à refaire en session locale).
