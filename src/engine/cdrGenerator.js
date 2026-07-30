// ── AAR Telco — Générateur de CDR réalistes ───────────────────────────────
// 50% légitimes / 50% frauduleux (SIM Box, Wangiri, IRSF, ATO)

const CELLS = [
  'BTS_DKR_001','BTS_DKR_002','BTS_DKR_003','BTS_DKR_004','BTS_DKR_005',
  'BTS_TBK_001','BTS_TBK_002','BTS_KLD_001','BTS_KLD_002','BTS_ZIG_001',
];
const WANGIRI_PREFIXES = ['+88160','+88161','+88213','+38241','+35318','+88214'];
const IRSF_PREFIXES    = ['+25470','+25571','+67670','+68810','+35318','+25622'];
const INTL_PREFIXES    = ['+33','+44','+49','+34','+212','+216','+237'];

const rnd  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function msisdn(prefix = '2217') {
  return prefix + String(rnd(10000000, 99999999));
}

function now(offsetSec = 0) {
  return new Date(Date.now() - offsetSec * 1000).toISOString();
}

// ── Profils MSISDN (instanciés une fois, réutilisés pour les séquences) ───
export const FRAUD_PROFILES = [
  // SIM BOX : 1 antenne fixe, >200 appels/24h, durée 15-60s, 90%+ intl
  { id:'SB-001', type:'simbox',   label:'SIM Box Dakar Nord',       msisdn:'221770SB0001', cell:'BTS_DKR_001', imsi:'608011SB0001', imei:'3501SB000001111' },
  { id:'SB-002', type:'simbox',   label:'SIM Box Thiès',            msisdn:'221770SB0002', cell:'BTS_TBK_001', imsi:'608011SB0002', imei:'3501SB000002222' },
  { id:'SB-003', type:'simbox',   label:'SIM Box Plateau',          msisdn:'221770SB0003', cell:'BTS_DKR_002', imsi:'608011SB0003', imei:'3501SB000003333' },
  // WANGIRI : 80%+ appels <3s, numéros premium internationaux
  { id:'WG-001', type:'wangiri',  label:'Wangiri Campagne 1',       msisdn:'221770WG0001', cell:null, imsi:'608011WG0001', imei:'3502WG000001111' },
  { id:'WG-002', type:'wangiri',  label:'Wangiri Flash Calls',      msisdn:'221770WG0002', cell:null, imsi:'608011WG0002', imei:'3502WG000002222' },
  // IRSF : 85%+ international, longue durée, SVA
  { id:'IF-001', type:'irsf',     label:'IRSF Destinations risque', msisdn:'221770IF0001', cell:null, imsi:'608011IF0001', imei:'3503IF000001111' },
  { id:'IF-002', type:'irsf',     label:'IRSF PBX Hack',            msisdn:'221770IF0002', cell:null, imsi:'608011IF0002', imei:'3503IF000002222' },
  // ATO : SIM swap récent + activité intense post-swap
  { id:'AT-001', type:'ato',      label:'ATO Post-Swap 1',          msisdn:'221770AT0001', cell:null, imsi:'608011AT0001', imei:'3504AT000001111' },
  { id:'AT-002', type:'ato',      label:'ATO Multi-Swap',           msisdn:'221770AT0002', cell:null, imsi:'608011AT0002', imei:'3504AT000002222' },
];

export const LEGIT_PROFILES = [
  { id:'LG-001', label:'Client normal 1',  msisdn:'221770LG0001', imsi:'608011LG0001', imei:'3509LG000001111' },
  { id:'LG-002', label:'Client normal 2',  msisdn:'221770LG0002', imsi:'608011LG0002', imei:'3509LG000002222' },
  { id:'LG-003', label:'Client normal 3',  msisdn:'221770LG0003', imsi:'608011LG0003', imei:'3509LG000003333' },
  { id:'LG-004', label:'Professionnel',    msisdn:'221770LG0004', imsi:'608011LG0004', imei:'3509LG000004444' },
  { id:'LG-005', label:'Diaspora',         msisdn:'221770LG0005', imsi:'608011LG0005', imei:'3509LG000005555' },
  { id:'LG-006', label:'Commercial local', msisdn:'221770LG0006', imsi:'608011LG0006', imei:'3509LG000006666' },
];

// ── Générateur de CDR selon le type de profil ─────────────────────────────
export function generateCDR(profile) {
  const ts = now(rnd(0, 60)); // dans la dernière minute
  const base = {
    msisdn_a:    profile.msisdn,
    imsi:        profile.imsi,
    imei:        profile.imei,
    start_time:  ts,
    call_type:   'MO',
  };

  switch (profile.type) {
    case 'simbox': {
      const isIntl = Math.random() < 0.93;
      const pfx    = isIntl ? pick(INTL_PREFIXES) : '221';
      return {
        ...base,
        msisdn_b:        pfx + rnd(600000000, 799999999),
        duration_sec:    rnd(15, 58),
        cell_id:         profile.cell,           // TOUJOURS la même antenne
        is_international: isIntl,
        is_premium:      false,
        country_code_b:  pfx.replace('+','').slice(0,3),
      };
    }
    case 'wangiri': {
      const pfx = pick(WANGIRI_PREFIXES);
      return {
        ...base,
        msisdn_b:        pfx + rnd(100000, 999999),
        duration_sec:    rnd(0, 2),              // appel très court
        cell_id:         pick(CELLS),
        is_international: true,
        is_premium:      true,                   // SVA international
        country_code_b:  pfx.replace('+','').slice(0,3),
      };
    }
    case 'irsf': {
      const pfx = pick(IRSF_PREFIXES);
      return {
        ...base,
        msisdn_b:        pfx + rnd(100000, 999999),
        duration_sec:    rnd(200, 800),          // longue durée
        cell_id:         pick(CELLS),
        is_international: true,
        is_premium:      true,
        country_code_b:  pfx.replace('+','').slice(0,3),
      };
    }
    case 'ato': {
      const isIntl = Math.random() < 0.55;
      const pfx    = isIntl ? pick(INTL_PREFIXES) : '221';
      return {
        ...base,
        msisdn_b:        pfx + rnd(600000000, 799999999),
        duration_sec:    rnd(30, 120),
        cell_id:         pick(CELLS),
        is_international: isIntl,
        is_premium:      Math.random() < 0.30,
        country_code_b:  pfx.replace('+','').slice(0,3),
      };
    }
    default: {
      // LÉGIT : appels normaux, variés, peu internationaux
      const isIntl = Math.random() < 0.08;
      const pfx    = isIntl ? pick(INTL_PREFIXES) : '221';
      return {
        ...base,
        msisdn_b:        pfx + rnd(600000000, 799999999),
        duration_sec:    rnd(30, 400),
        cell_id:         pick(CELLS),            // antennes variées
        is_international: isIntl,
        is_premium:      Math.random() < 0.02,
        country_code_b:  pfx.replace('+','').slice(0,3),
      };
    }
  }
}

// ── Séquence de CDR mixte (50% fraud / 50% légit) ─────────────────────────
// Retourne une fonction qui génère le prochain CDR de la séquence
export function createBatchSequence() {
  const allProfiles = [...FRAUD_PROFILES, ...LEGIT_PROFILES];
  let cursor = 0;

  // Mélanger pour intercaler fraud/légit
  const shuffled = [...allProfiles].sort(() => Math.random() - 0.5);

  return function nextCDR() {
    const profile = shuffled[cursor % shuffled.length];
    cursor++;
    const cdr = generateCDR(profile);
    return { cdr, profile };
  };
}
