// Jeu de démo daté sur les 7 derniers jours, produit par le VRAI moteur de règles :
// chaque alerte correspond à des règles réellement déclenchées sur l'historique CDR inséré.
import fs from 'fs'
const ROOT = process.argv[2]; const DRY = process.argv[3] === 'dry'
const { MsisdnState, processCDR } = await import(ROOT + '/src/engine/ruleEngine.js?' + Date.now())
const gen = await import(ROOT + '/src/engine/cdrGenerator.js?' + Date.now())
const rd = (f) => Object.fromEntries(fs.readFileSync(ROOT + f, 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const URL_ = rd('/.env').VITE_SUPABASE_URL, KEY = rd('/.env.server').SUPABASE_LEGACY_SERVICE_ROLE
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }
const get = async (q) => (await fetch(URL_ + '/rest/v1/' + q, { headers: H })).json()
const post = async (t, rows) => {
  for (let i = 0; i < rows.length; i += 400) {
    const r = await fetch(URL_ + '/rest/v1/' + t, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(rows.slice(i, i + 400)) })
    if (!r.ok) { console.error(t, r.status, (await r.text()).slice(0, 300)); process.exit(1) }
  }
}
const rules = (await get('rules?select=*&scope=eq.telco')).filter(r => r.active)
const ops = await get('operators?select=id,name,code')
const OP = ops.find(o => o.code === 'PSN') || ops[0]
console.log('opérateur des données de démo :', OP.name)

const LABEL = { simbox: 'SIM Box', wangiri: 'Wangiri', irsf: 'IRSF', ato: 'ATO' }
const REASON = {
  simbox: "SIM Box : appels sortants locaux en masse depuis une antenne unique, sans SMS ni data",
  wangiri: "Wangiri : rafales d'appels très courts (< 3 s) vers des numéros surtaxés internationaux",
  irsf: "IRSF : appels internationaux longs vers des destinations surtaxées à risque",
  ato: "Prise de contrôle : SIM swap suivi d'un nouvel IMEI, d'un accès mobile money et d'appels vers de nouveaux pays",
}
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
const digits = (n) => Array.from({ length: n }, () => rnd(0, 9)).join('')
const realNow = Date.now(); const origNow = Date.now.bind(Date)
const alerts = [], blockings = [], cdrs = []
const DAY = 86400000
for (let d = 6; d >= 0; d--) {
  for (const fam of gen.FRAUD_PROFILES) {
    const n = fam.type === 'simbox' ? rnd(1, 3) : rnd(0, 2)
    for (let k = 0; k < n; k++) {
      // instant de détection : dans la journée d (aujourd'hui : avant maintenant - 1 h)
      const dayStart = new Date(realNow - d * DAY); dayStart.setUTCHours(0, 0, 0, 0)
      const maxT = d === 0 ? realNow - 3600e3 : dayStart.getTime() + DAY - 1
      const T = dayStart.getTime() + Math.random() * Math.max(0, maxT - dayStart.getTime())
      if (T <= dayStart.getTime()) continue
      Date.now = () => T
      const msisdn = fam.type === 'simbox' ? fam.msisdn.slice(0, 5) + digits(7) : '2217' + '05678'[rnd(0, 4)] + digits(7)
      const line = { ...fam, family: fam.id, msisdn, imsi: '60801' + digits(10), imei: '35' + digits(13) }
      const st = new MsisdnState(msisdn); const mine = []
      const add = st.addCDR.bind(st); st.addCDR = (c) => { mine.push(c); add(c) }
      gen.prewarmProfile(st, line)
      let res = null
      for (let i = 0; i < 3; i++) { const c = gen.generateCDR(line, T - (2 - i) * 20000); res = processCDR(c, st, rules) }
      Date.now = origNow
      const trig = res.triggered
      if (!trig.length) continue
      const top = trig.find(r => r.action === 'block') || trig[0]
      const iso = new Date(T).toISOString()
      // ATO : la ligne appartient à une victime, on enquête et on protège le compte au lieu de bloquer le numéro
      const victim = fam.type === 'ato'
      const status = victim ? (Math.random() < 0.5 ? 'investigating' : 'escalated') : top.action === 'block' ? 'blocked' : 'open'
      alerts.push({ id: crypto.randomUUID(), msisdn, imei: line.imei, imsi: line.imsi, type: fam.type, fraud_type: LABEL[fam.type],
        status, score: Math.min(100, 60 + trig.length * 5), severity: fam.type === 'irsf' ? 'critical' : top.severity || 'high',
        reason: `${REASON[fam.type]}. Règles : ${trig.map(r => r.name).join(' ; ')}`.slice(0, 900),
        date: iso.slice(0, 10), operator: OP.name, operator_id: OP.id, created_at: iso, scope: 'telco' })
      if (!victim && top.action === 'block') blockings.push({ id: crypto.randomUUID(), msisdn, reason: REASON[fam.type], source: 'shield_auto', active: true,
        operator: OP.name, operator_id: OP.id, auto_flagged: trig.map(r => r.name), created_at: iso })
      for (const c of mine.slice(-40)) cdrs.push({ msisdn_a: c.msisdn_a, msisdn_b: c.msisdn_b, imsi: c.imsi, imei: c.imei, cell_id: c.cell_id,
        duration_sec: c.duration_sec, start_time: c.start_time, call_type: c.call_type || 'MO', is_international: !!c.is_international,
        is_premium: !!c.is_premium, country_code_b: c.country_code_b, operator_id: OP.id })
    }
  }
}
const perDay = {}; for (const a of alerts) perDay[a.date] = (perDay[a.date] || 0) + 1
console.log('alertes', alerts.length, 'blocages', blockings.length, 'CDR', cdrs.length, perDay)
console.log('exemple', JSON.stringify(alerts[0]).slice(0, 400))
if (!DRY) { await post('cdr_voice', cdrs); await post('alerts', alerts); await post('blockings', blockings); console.log('insertion terminée') }
