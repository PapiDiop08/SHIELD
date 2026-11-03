// Banc d'essai hors ligne : vraies règles de la base + corrections proposées, simulateur rejoué
import fs from 'fs'
const ROOT = process.argv[2]; const N = Number(process.argv[3] || 6000); const APPLY = process.argv[4] !== 'raw'
const { MsisdnState, processCDR, isRuleEvaluable } = await import(ROOT + '/src/engine/ruleEngine.js?' + Date.now())
const gen = await import(ROOT + '/src/engine/cdrGenerator.js?' + Date.now())
const env = Object.fromEntries(fs.readFileSync(ROOT + '/.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const srv = Object.fromEntries(fs.readFileSync(ROOT + '/.env.server', 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const KEY = srv.SUPABASE_LEGACY_SERVICE_ROLE
const rules = await (await fetch(env.VITE_SUPABASE_URL + '/rest/v1/rules?select=*&scope=eq.telco', { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } })).json()
export const FIXES = JSON.parse(fs.readFileSync(new URL('./rule_fixes.json', import.meta.url)))
if (APPLY) for (const r of rules) if (FIXES[r.id]) r.conditions = FIXES[r.id]
const fam = (r) => /SIM Box|Concentration/i.test(r.name) ? 'simbox' : /Wangiri/i.test(r.name) ? 'wangiri' : /IRSF|PBX/i.test(r.name) ? 'irsf' : /ATO/i.test(r.name) ? 'ato' : 'autre'

// Horloge simulée : 10 CDR par seconde (vitesse « Rapide », 3 CDR / 0,3 s)
const T0 = Date.now(); let clock = T0; Date.now = () => clock
const states = {}
gen.prewarmStates(states, MsisdnState)
const next = gen.createBatchSequence()
const fired = {}, byType = {}, cross = {}, firstHit = {}
let legitHits = 0, legitN = 0, fraudN = 0, fraudDetected = 0
const legitRules = {}
for (let i = 0; i < N; i++) {
  clock = T0 + i * 100
  const { cdr, profile } = next()
  states[cdr.msisdn_a] ||= new MsisdnState(cdr.msisdn_a)
  const { triggered } = processCDR(cdr, states[cdr.msisdn_a], rules)
  const t = profile.type || 'legit'
  if (t === 'legit') { if (cdr.call_type !== 'MT') { legitN++; if (triggered.length) { legitHits++; triggered.forEach(r => legitRules[r.id] = (legitRules[r.id] || 0) + 1) } } }
  else { fraudN++; if (triggered.length) { fraudDetected++; firstHit[profile.id] ??= i } }
  byType[t] ||= {}
  for (const r of triggered) {
    fired[r.id] = (fired[r.id] || 0) + 1; byType[t][r.id] = (byType[t][r.id] || 0) + 1
    if (t !== 'legit' && fam(r) !== 'autre' && fam(r) !== t) cross[`${t} -> ${r.id} ${r.name}`] = (cross[`${t} -> ${r.id} ${r.name}`] || 0) + 1
  }
}
console.log(`CDR simulés : ${N} | règles telco : ${rules.length} | corrections appliquées : ${APPLY}`)
console.log(`règles déclenchées : ${Object.keys(fired).length}/${rules.length}`)
for (const [t, m] of Object.entries(byType)) console.log(` ${t.padEnd(8)} ${Object.keys(m).sort().join(' ') || '-'}`)
console.log(`taux de détection fraude : ${(100 * fraudDetected / fraudN).toFixed(1)}% | premier CDR détecté par profil :`, JSON.stringify(firstHit))
console.log(`faux positifs légitimes : ${legitHits}/${legitN}`, JSON.stringify(legitRules))
console.log('croisements de famille :', Object.keys(cross).length ? '' : 'aucun'); for (const [k, v] of Object.entries(cross)) console.log('  ', v, k)
const probe = new MsisdnState('x'); probe.addCDR({ start_time: new Date().toISOString(), duration_sec: 1 })
const nonEval = rules.filter(r => !isRuleEvaluable(r, probe.metrics))
console.log(`règles non évaluables (données absentes du CDR voix) : ${nonEval.length} ->`, nonEval.map(r => r.id).join(' '))
const neverEval = rules.filter(r => isRuleEvaluable(r, probe.metrics) && !fired[r.id])
console.log('évaluables mais non déclenchées :', neverEval.map(r => r.id + ' ' + r.name).join(' | '))
