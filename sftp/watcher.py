#!/usr/bin/env python3
"""
SHIELD — Watcher d'ingestion CDR.
Surveille sftp/incoming/, et dès qu'un fichier CSV y est déposé (par un
partenaire via SFTP, ou manuellement pour un test), l'ingère dans le vrai
pipeline serveur (shield_ingest_cdr_batch) puis le déplace vers processed/
ou error/ selon le résultat. C'est EXACTEMENT le chemin qu'empruntera un
flux SFTP opérateur réel demain.
"""
import csv
import json
import os
import shutil
import sys
import time
import traceback
from datetime import datetime, timezone

import requests

BASE = os.path.dirname(os.path.abspath(__file__))
INCOMING = os.path.join(BASE, "incoming")
PROCESSED = os.path.join(BASE, "processed")
ERROR = os.path.join(BASE, "error")
LOG = os.path.join(BASE, "watcher.log")

ENV_PATH = os.path.join(os.path.dirname(BASE), ".env.server")


def load_env():
    env = {}
    with open(ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k] = v
    return env


ENV = load_env()
SUPABASE_URL = f"https://{ENV['SUPABASE_PROJECT_REF']}.supabase.co"
SECRET_KEY = ENV["SUPABASE_SECRET_KEY"]

REQUIRED_COLS = ["msisdn_a"]
OPTIONAL_DEFAULTS = {
    "call_type": "OUT",
    "is_international": "false",
    "is_premium": "false",
    "direction": "MO",
}
BOOL_COLS = {"is_international", "is_premium"}
INT_COLS = {"duration_sec"}


def log(msg):
    line = f"[{datetime.now(timezone.utc).isoformat()}] {msg}"
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def parse_csv(path):
    rows = []
    errors = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, raw in enumerate(reader, start=2):  # ligne 1 = header
            row = {}
            missing = [c for c in REQUIRED_COLS if not raw.get(c)]
            if missing:
                errors.append(f"ligne {i}: colonnes manquantes {missing}")
                continue
            for k, v in raw.items():
                if v is None or v == "":
                    if k in OPTIONAL_DEFAULTS:
                        v = OPTIONAL_DEFAULTS[k]
                    else:
                        continue
                if k in BOOL_COLS:
                    row[k] = str(v).strip().lower() in ("1", "true", "t", "yes")
                elif k in INT_COLS:
                    try:
                        row[k] = int(v)
                    except ValueError:
                        errors.append(f"ligne {i}: {k}='{v}' invalide")
                        continue
                else:
                    row[k] = v
            rows.append(row)
    return rows, errors


def ingest_file(path):
    filename = os.path.basename(path)
    log(f"Nouveau fichier détecté : {filename}")
    t0 = time.time()
    try:
        rows, parse_errors = parse_csv(path)
        if not rows:
            raise ValueError(f"aucune ligne exploitable ({len(parse_errors)} erreurs de parsing)")

        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/shield_ingest_cdr_batch",
            headers={
                "Authorization": f"Bearer {SECRET_KEY}",
                "apikey": SECRET_KEY,
                "Content-Type": "application/json",
            },
            json={"p_rows": rows, "p_filename": filename, "p_source": "sftp-partner"},
            timeout=60,
        )
        resp.raise_for_status()
        result = resp.json()
        elapsed_ms = (time.time() - t0) * 1000
        log(
            f"  -> ingéré : {result.get('rows_ingested')} CDR en "
            f"{result.get('processing_ms'):.1f} ms côté serveur "
            f"({elapsed_ms:.0f} ms bout-en-bout). batch_id={result.get('batch_id')}"
        )
        if parse_errors:
            log(f"  -> {len(parse_errors)} lignes ignorées (parsing) : {parse_errors[:5]}")

        dest = os.path.join(PROCESSED, f"{datetime.now(timezone.utc):%Y%m%dT%H%M%S}_{filename}")
        shutil.move(path, dest)
        return True
    except Exception as e:
        log(f"  -> ERREUR : {e}\n{traceback.format_exc()}")
        dest = os.path.join(ERROR, f"{datetime.now(timezone.utc):%Y%m%dT%H%M%S}_{filename}")
        try:
            shutil.move(path, dest)
        except Exception:
            pass
        return False


def main():
    for d in (INCOMING, PROCESSED, ERROR):
        os.makedirs(d, exist_ok=True)
    log(f"Watcher démarré. Surveillance de {INCOMING}")
    seen = set()
    while True:
        try:
            for fn in sorted(os.listdir(INCOMING)):
                path = os.path.join(INCOMING, fn)
                if not os.path.isfile(path) or fn.startswith("."):
                    continue
                if not fn.lower().endswith(".csv"):
                    continue
                # Attendre que le fichier soit stable (upload SFTP terminé)
                size1 = os.path.getsize(path)
                time.sleep(0.5)
                if not os.path.exists(path) or os.path.getsize(path) != size1:
                    continue
                ingest_file(path)
        except Exception as e:
            log(f"Erreur boucle watcher : {e}")
        time.sleep(2)


if __name__ == "__main__":
    main()
