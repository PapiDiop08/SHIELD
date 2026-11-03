// Applique rule_fixes.json aux règles Telco (sauvegarde préalable dans telco_rules_backup_<date>.json)
import fs from 'fs'
const ROOT = process.argv[2]
const DIR = new URL('.', import.meta.url)
const rd = (f) => Object.fromEntries(fs.readFileSync(ROOT + f, 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const URL_ = rd('/.env').VITE_SUPABASE_URL, KEY = rd('/.env.server').SUPABASE_LEGACY_SERVICE_ROLE
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const all = await (await fetch(URL_ + '/rest/v1/rules?select=*&scope=eq.telco', { headers: H })).json()
fs.writeFileSync(new URL('telco_rules_backup_' + new Date().toISOString().slice(0, 10) + '.json', DIR), JSON.stringify(all, null, 1))
const fixes = JSON.parse(fs.readFileSync(new URL('rule_fixes.json', DIR)))
for (const [id, conditions] of Object.entries(fixes)) {
  const r = await fetch(URL_ + '/rest/v1/rules?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: H, body: JSON.stringify({ conditions }) })
  const j = await r.json()
  console.log(id, r.status, Array.isArray(j) && j.length === 1 ? 'OK ' + j[0].conditions.length + ' conditions' : JSON.stringify(j).slice(0, 120))
}
