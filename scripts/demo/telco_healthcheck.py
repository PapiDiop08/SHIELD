#!/usr/bin/env python3
"""Contrôle de santé de la base AAR Telco (lecture seule). Lancer depuis le dossier shield/."""
import json, os, re, sys, urllib.request, collections

def envfile(p):
    d = {}
    for l in open(p):
        if '=' in l and not l.strip().startswith('#'):
            k, v = l.rstrip('\n').split('=', 1); d[k.strip()] = v.strip()
    return d

E = envfile('.env'); S = envfile('.env.server')
URL = E['VITE_SUPABASE_URL']; KEY = S.get('SUPABASE_LEGACY_SERVICE_ROLE') or S.get('SUPABASE_SECRET_KEY')

def get(path):
    req = urllib.request.Request(f'{URL}/rest/v1/{path}', headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}'})
    with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read())

def rpc(name, body):
    req = urllib.request.Request(f'{URL}/rest/v1/rpc/{name}', data=json.dumps(body).encode(),
        headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read())

out = {}
rules = get('rules?select=*')
out['rules_by_scope'] = collections.Counter(r.get('scope') for r in rules)
tel = [r for r in rules if r.get('scope') == 'telco']
out['telco_rules'] = len(tel)
out['telco_active'] = sum(1 for r in tel if r.get('active') or r.get('status') == 'active' or r.get('enabled'))
out['rule_columns'] = sorted(rules[0].keys()) if rules else []
out['telco_rule_names'] = sorted((r.get('code') or r.get('rule_code') or r.get('id'), r.get('name'), r.get('action'), r.get('active', r.get('status'))) for r in tel)
udf = get('udf_fields?select=*')
out['udf_columns'] = sorted(udf[0].keys()) if udf else []
out['udf_by_scope'] = collections.Counter(u.get('scope') for u in udf)
udf_keys = {u.get('field_key') or u.get('key') or u.get('name') for u in udf}
# champs références par les règles telco
refs = collections.Counter()
for r in tel:
    s = json.dumps(r.get('conditions') or r.get('condition') or r.get('logic') or '')
    for m in re.findall(r'"field"\s*:\s*"([a-z0-9_]+)"', s): refs[m] += 1
out['fields_ref_by_telco_rules'] = dict(refs)
out['fields_missing_in_udf'] = sorted(f for f in refs if f not in udf_keys)
out['operators'] = [(o.get('name'), o.get('code'), o.get('status'), o.get('country')) for o in get('operators?select=*')]
out['profiles'] = [(p.get('email'), p.get('role'), p.get('operator') or p.get('operator_id'), p.get('active')) for p in get('profiles?select=*')]
al = get('alerts?select=*&order=created_at.desc&limit=2000')
out['alerts_by_scope'] = collections.Counter(a.get('scope') for a in al)
out['alerts_latest'] = al[0].get('created_at') if al else None
out['alert_columns'] = sorted(al[0].keys()) if al else []
cv = get('cdr_voice?select=*&order=start_time.desc&limit=1') if True else []
out['cdr_voice_cols'] = sorted(cv[0].keys()) if cv else []
out['cdr_voice_latest'] = cv[0].get('start_time') if cv else None
try:
    out['computable_fields'] = rpc('shield_computable_fields', {})
except Exception as e:
    out['computable_fields'] = f'ERR {e}'
print(json.dumps(out, indent=1, default=str, ensure_ascii=False))
