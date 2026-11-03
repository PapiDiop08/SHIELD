// ── AAR Telco — Générateur de CDR réalistes (démo / simulateur) ────────────
// Profils frauduleux et légitimes avec des signatures conformes au terrain :
//   SIM Box  : appels SORTANTS LOCAUX en masse, une seule antenne, IMEI fixe,
//              aucun appel entrant, aucun SMS, aucune data, micro-rechargements
//   Wangiri  : rafales d'appels très courts (0-2 s) vers des numéros surtaxés
//   IRSF     : appels internationaux longs vers des destinations à risque
//   ATO      : SIM swap suivi d'un changement d'IMEI, d'accès au portefeuille
//              mobile money, de rechargements et d'appels vers de nouveaux pays
// Identifiants au format réel : MSISDN 221 7X XXX XX XX, IMSI 608 01 + 10 chiffres,
// IMEI 15 chiffres.

const CELLS = [
  'DKR-PLT-0412', 'DKR-MRM-0218', 'DKR-PKN-0731', 'DKR-GRY-0905', 'DKR-YOF-0127',
  'THS-CTR-0310', 'THS-NRD-0322', 'KDK-CTR-0144', 'MBR-CTR-0409', 'ZIG-CTR-0611',
];
const WANGIRI_PREFIXES = ['+88160', '+88213', '+88234', '+38241', '+35318'];
const IRSF_DEST = ['+67670', '+68810'];              // Tonga, Tuvalu (listes fraude)
const PBX_DEST  = ['+252619834471', '+239981226405']; // Somalie, São Tomé
const INTL_LEGIT = ['+33', '+1', '+39', '+34', '+225', '+223', '+212'];

const rnd  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const digits = (n) => Array.from({ length: n }, () => rnd(0, 9)).join('');
const localMsisdn = () => '2217' + pick(['0', '5', '6', '7', '8']) + digits(7);
const CODES = ['1', '33', '34', '39', '212', '223', '225', '229', '234', '239', '252', '353', '382', '676', '688', '881', '882'];
const cc = (num) => { const d = num.replace('+', ''); return CODES.filter(c => d.startsWith(c)).sort((a, b) => b.length - a.length)[0] || d.slice(0, 3); };
const iso = (ms) => new Date(ms).toISOString();

const mk = (id, type, label, msisdn, extra = {}) => ({
  id, type, label, msisdn,
  imsi: '60801' + digits(10), imei: '35' + digits(13), ...extra,
});

// Familles de fraude affichées dans le simulateur. Chaque famille regroupe
// plusieurs lignes, comme sur le terrain (une SIM Box = un rack de SIM sur la
// même antenne, une campagne Wangiri = plusieurs numéros émetteurs, etc.).
export const FRAUD_PROFILES = [
  mk('SB-001', 'simbox',  'SIM Box Dakar Plateau',      '221776041187', { cell: 'DKR-PLT-0412', size: 6 }),
  mk('SB-002', 'simbox',  'SIM Box Thiès',              '221705512903', { cell: 'THS-CTR-0310', size: 6 }),
  mk('SB-003', 'simbox',  'SIM Box Pikine',             '221768830245', { cell: 'DKR-PKN-0731', size: 6 }),
  mk('WG-001', 'wangiri', 'Wangiri campagne',           '221783347716', { size: 5 }),
  mk('WG-002', 'wangiri', 'Wangiri flash calls',        '221759902318', { size: 5 }),
  mk('IF-001', 'irsf',    'IRSF destinations à risque', '221774418862', { size: 4 }),
  mk('IF-002', 'irsf',    'IRSF PBX piraté',            '221338217045', { size: 1 }),
  mk('AT-001', 'ato',     'SIM swap + mobile money',    '221772290634', { size: 4 }),
  mk('AT-002', 'ato',     'SIM swaps multiples',        '221706643159', { size: 4 }),
];
// Lignes individuelles de chaque famille (la première reprend le numéro de la famille)
export const FRAUD_LINES = FRAUD_PROFILES.flatMap(f => Array.from({ length: f.size }, (_, k) => (k === 0 ? { ...f, family: f.id } : {
  ...f, family: f.id, id: `${f.id}-${k + 1}`,
  msisdn: f.id === 'IF-002' ? f.msisdn : (f.type === 'simbox' ? f.msisdn.slice(0, 5) : '2217' + pick(['0', '5', '6', '7', '8'])) + digits(f.type === 'simbox' ? 7 : 7),
  imsi: '60801' + digits(10), imei: '35' + digits(13),
})));

export const LEGIT_PROFILES = [
  mk('LG-001', null, 'Client particulier',   '221771538824', { intl: 0.03 }),
  mk('LG-002', null, 'Étudiant',             '221764420917', { intl: 0.02 }),
  mk('LG-003', null, 'Commerçante',          '221785516043', { intl: 0.05 }),
  mk('LG-004', null, 'Professionnel',        '221776902281', { intl: 0.10 }),
  mk('LG-005', null, 'Client diaspora',      '221707734158', { intl: 0.35 }),
  mk('LG-006', null, 'Chauffeur',            '221753318406', { intl: 0.02 }),
];

// Population d'abonnés légitimes : chaque appel légitime provient d'un abonné
// différent, comme sur un vrai réseau (peu d'appels par abonné et par heure).
export const LEGIT_POOL = Array.from({ length: 1500 }, (_, i) => {
  const p = LEGIT_PROFILES[i % LEGIT_PROFILES.length];
  return { ...p, id: `${p.id}-${i}`, msisdn: localMsisdn(), imsi: '60801' + digits(10), imei: '35' + digits(13) };
});

// ── Un CDR selon le profil (ts = horodatage en ms) ─────────────────────────
export function generateCDR(profile, ts = Date.now() - rnd(0, 30) * 1000) {
  const base = { msisdn_a: profile.msisdn, imsi: profile.imsi, imei: profile.imei, start_time: iso(ts), call_type: 'MO' };
  switch (profile.type) {
    case 'simbox':
      return { ...base, msisdn_b: localMsisdn(), duration_sec: rnd(15, 58), cell_id: profile.cell,
        is_international: false, is_premium: false, country_code_b: '221' };
    case 'wangiri': {
      const b = pick(WANGIRI_PREFIXES) + digits(6);
      return { ...base, msisdn_b: b, duration_sec: rnd(0, 2), cell_id: null, // automate d'appels (passerelle, pas d'antenne)
        is_international: true, is_premium: true, country_code_b: cc(b) };
    }
    case 'irsf': {
      const b = profile.family === 'IF-002' ? pick(PBX_DEST) : pick(IRSF_DEST) + digits(5);
      return { ...base, msisdn_b: b, duration_sec: rnd(240, 900), cell_id: profile.family === 'IF-002' ? null : pick(CELLS), // IF-002 = ligne fixe / trunk PBX
        is_international: true, is_premium: true, country_code_b: cc(b) };
    }
    case 'ato': {
      const intl = Math.random() < 0.5;
      const b = intl ? pick(['+234', '+225', '+229']) + digits(9) : localMsisdn();
      return { ...base, msisdn_b: b, duration_sec: rnd(30, 180), cell_id: pick(CELLS),
        is_international: intl, is_premium: false, country_code_b: intl ? cc(b) : '221' };
    }
    default: { // légitime
      if (Math.random() < 0.3) { // appel entrant
        return { ...base, call_type: 'MT', msisdn_b: localMsisdn(), duration_sec: rnd(20, 400), cell_id: pick(CELLS),
          is_international: false, is_premium: false, country_code_b: '221' };
      }
      const intl = Math.random() < (profile.intl || 0.05);
      const b = intl ? pick(INTL_LEGIT) + digits(9) : localMsisdn();
      return { ...base, msisdn_b: b, duration_sec: rnd(25, intl ? 900 : 420), cell_id: pick(CELLS),
        is_international: intl, is_premium: false, country_code_b: intl ? cc(b) : '221',
        sms_out: Math.random() < 0.3 ? 1 : 0, data_mb: Math.random() < 0.4 ? rnd(5, 120) : 0 };
    }
  }
}

// ── Séquence de CDR mixte pour le flux temps réel ─────────────────────────
// Trafic pondéré : les profils frauduleux sont surreprésentés pour la démo.
// Cadence maximale par ligne (secondes entre deux appels d'une même ligne) :
// respecte les rythmes du terrain même si le flux de démo est accéléré.
const MIN_GAP_S = { simbox: 15, wangiri: 0, irsf: 45, 'IF-002': 10, ato: 120, legit: 90 };

export function createBatchSequence() {
  // 9 familles de fraude pour 24 tirages légitimes : environ 27 % de trafic frauduleux
  const weighted = [...FRAUD_PROFILES];
  for (let i = 0; i < 4; i++) weighted.push(...LEGIT_PROFILES);
  const shuffled = weighted.sort(() => Math.random() - 0.5);
  const lastCall = new Map();
  let cursor = 0;
  const ready = (line, now) => {
    const gap = MIN_GAP_S[line.family === 'IF-002' ? 'IF-002' : (line.type || 'legit')] * 1000;
    return now - (lastCall.get(line.msisdn) || 0) >= gap;
  };
  return function nextCDR() {
    const now = Date.now();
    const slot = shuffled[cursor % shuffled.length];
    cursor++;
    let profile = null;
    if (slot.type) {
      const lines = FRAUD_LINES.filter(l => l.family === slot.id && ready(l, now));
      if (lines.length) profile = pick(lines);
    }
    for (let k = 0; !profile && k < 20; k++) { const c = pick(LEGIT_POOL); if (ready(c, now)) profile = c; }
    if (!profile) profile = pick(LEGIT_POOL);
    lastCall.set(profile.msisdn, now);
    return { cdr: generateCDR(profile), profile };
  };
}

// ── Historique réaliste des dernières 24 h (sans écriture en base) ─────────
// Donne à chaque MSISDN un passé cohérent avec son profil, afin que les règles
// basées sur des volumes 24 h se déclenchent dès les premiers CDR du flux.
const H = 3600 * 1000;
function pastTimes(n, fromH, toH, nightOnly = false) {
  const now = Date.now(), out = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 50) {
    const t = now - (fromH + Math.random() * (toH - fromH)) * H;
    if (!nightOnly || new Date(t).getUTCHours() < 6) out.push(t);
  }
  return out.sort((a, b) => a - b);
}

function seed(state, profile, events) {
  for (const e of events.sort((a, b) => a.ts - b.ts)) {
    if (e.kind === 'swap') { state.addSwap(e.ts); continue; }
    const cdr = e.kind === 'cdr' ? generateCDR(profile, e.ts) : {
      msisdn_a: profile.msisdn, imsi: profile.imsi, imei: profile.imei, start_time: iso(e.ts), call_type: 'MT',
      msisdn_b: localMsisdn(), duration_sec: rnd(20, 300), cell_id: profile.cell || pick(CELLS),
      is_international: false, is_premium: false, country_code_b: '221',
    };
    Object.assign(cdr, e.extra || {});
    state.addCDR(cdr);
  }
}

export function prewarmStates(stateMap, MsisdnStateClass) {
  const now = Date.now();
  const ev = (kind, ts, extra) => ({ kind, ts, extra });
  for (const p of [...FRAUD_LINES, ...LEGIT_POOL]) {
    const st = (stateMap[p.msisdn] = new MsisdnStateClass(p.msisdn));
    const events = [];
    switch (p.type) {
      case 'simbox':
        pastTimes(rnd(215, 260), 0.2, 20).forEach(t => events.push(ev('cdr', t)));
        pastTimes(8, 1, 20).forEach(t => events.push(ev('cdr', t, { recharge: 500 })));
        break;
      case 'wangiri':
        pastTimes(200, 0.2, 16).forEach(t => events.push(ev('cdr', t)));
        pastTimes(15, 1, 22).forEach(t => events.push(ev('mt', t)));
        pastTimes(12, 1, 22).forEach(t => events.push(ev('cdr', t, { msisdn_b: localMsisdn(), duration_sec: rnd(30, 200), is_international: false, is_premium: false, country_code_b: '221', sms_out: 1, data_mb: 40 })));
        break;
      case 'irsf':
        if (p.family === 'IF-002') pastTimes(140, 0.5, 23.5, true).forEach(t => events.push(ev('cdr', t)));
        else pastTimes(120, 0.2, 16).forEach(t => events.push(ev('cdr', t)));
        pastTimes(30, 1, 22).forEach(t => events.push(ev('mt', t)));
        pastTimes(15, 1, 22).forEach(t => events.push(ev('cdr', t, { msisdn_b: localMsisdn(), duration_sec: rnd(30, 200), is_international: false, is_premium: false, country_code_b: '221', sms_out: 1, data_mb: 35 })));
        break;
      case 'ato': {
        const multi = p.family === 'AT-002';
        const swapTs = now - (multi ? 10 : 3) * H - rnd(0, 40) * 60 * 1000;
        // vie normale avant le swap (ancien IMEI / IMSI, appels locaux et vers la France)
        pastTimes(20, multi ? 11 : 4, 23).forEach(t => events.push(ev('cdr', t, {
          imei: '35' + p.imei.slice(2, 8) + '0000000', imsi: '60801' + p.imsi.slice(5, 10) + '00000',
          msisdn_b: localMsisdn(), is_international: false, country_code_b: '221', sms_out: 1, data_mb: 60 })));
        pastTimes(10, 4, 23).forEach(t => events.push(ev('mt', t)));
        if (multi) { events.push(ev('swap', now - 12 * 24 * H)); events.push(ev('swap', now - 5 * 24 * H)); }
        events.push(ev('cdr', swapTs, { sim_swap: true, msisdn_b: localMsisdn(), is_international: false, country_code_b: '221' }));
        events.push(ev('cdr', swapTs + 20 * 60 * 1000, { mm_access: true }));
        events.push(ev('cdr', swapTs + 30 * 60 * 1000, { recharge: 15000 }));
        if (multi) { // valse d'IMSI : signe d'IMSI catching / clonage
          for (let i = 1; i <= 4; i++) events.push(ev('cdr', swapTs + i * 40 * 60 * 1000, { imsi: '60801' + digits(10) }));
        }
        const postN = 15;
        for (let i = 0; i < postN; i++) events.push(ev('cdr', swapTs + (35 + i * 9) * 60 * 1000));
        break;
      }
      default: // légitime : quelques appels sortants, entrants, SMS et data sur la journée
        pastTimes(rnd(3, 9), 0.5, 23).forEach(t => events.push(ev('cdr', t)));
        pastTimes(rnd(3, 8), 0.5, 23).forEach(t => events.push(ev('mt', t)));
        pastTimes(2, 0.5, 23).forEach(t => events.push(ev('cdr', t, { sms_out: 2, data_mb: 150 })));
    }
    seed(st, p, events);
  }
}
