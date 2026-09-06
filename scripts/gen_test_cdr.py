import json, random, datetime, sys, csv

random.seed(42)
now = datetime.datetime.utcnow()
msisdn = "221771112233"
rows = []
N = 350  # > 300 pour t12 (call_out_2h>300) et > 200 pour t09
for i in range(N):
    # étalé sur les 2 dernières heures, un seul B distinct par appel (SIM Box)
    ts = now - datetime.timedelta(seconds=random.randint(0, 7200 - i))
    rows.append({
        "msisdn_a": msisdn,
        "msisdn_b": f"33612{300000+i:06d}",
        "imsi": "608011234567890",
        "imei": "356938035643809",
        "cell_id": "CELL-TEST-01",       # une seule cellule -> unique_cells=1
        "duration_sec": random.randint(10, 45),  # <60s -> avg_duration_sec<60
        "start_time": ts.isoformat() + "Z",
        "call_type": "OUT",
        "is_international": True,
        "is_premium": False,
        "country_code_b": "33",
        "operator_id": "op1",
        "direction": "MO",
        "network_type": "2G",
    })

with open("test_cdr_simbox.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)

with open("/tmp/test_cdr_simbox.json", "w") as f:
    json.dump(rows, f)

print(f"Généré {N} CDR pour {msisdn} -> test_cdr_simbox.csv")
