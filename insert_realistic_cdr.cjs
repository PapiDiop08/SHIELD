const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
// Identifiants lus depuis l'environnement (jamais en dur dans le code) :
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node insert_realistic_cdr.cjs
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Définir SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans l\'environnement.');
  process.exit(1);
}
const sb = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } }
);

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function uid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16); }); }

function tsBack(hoursAgo) {
  const d = new Date('2026-07-28T12:00:00Z');
  d.setHours(d.getHours() - hoursAgo);
  d.setMinutes(rnd(0,59)); d.setSeconds(rnd(0,59));
  return d.toISOString();
}

const CELLS_LOCAL = ['BTS_DKR_001','BTS_DKR_002','BTS_DKR_003','BTS_DKR_004','BTS_DKR_005',
  'BTS_DKR_006','BTS_DKR_007','BTS_DKR_008','BTS_DKR_009','BTS_DKR_010',
  'BTS_TBK_001','BTS_TBK_002','BTS_KLD_001','BTS_KLD_002','BTS_ZIG_001'];
const IMSI_PREFIX = '60801';
const IMEI_LIST = ['35'+'1'.repeat(13),'35'+'2'.repeat(13),'35'+'3'.repeat(13),'35'+'4'.repeat(13),'35'+'5'.repeat(13)];

// ── Profils frauduleux ──────────────────────────────────────────────────────
const PROFILES = [
  // SIM BOX (1 antenne fixe, volume massif, durée 15-60s)
  { msisdn:'22170000001', type:'simbox', calls:320, cell:'BTS_DKR_001', dur:[15,55], intl_ratio:0.95, premium_ratio:0.02, short_ratio:0.05, imsi:'608011000001', imei:'350111111111111' },
  { msisdn:'22170000002', type:'simbox', calls:280, cell:'BTS_DKR_002', dur:[20,50], intl_ratio:0.92, premium_ratio:0.01, short_ratio:0.03, imsi:'608011000002', imei:'350222222222222' },
  { msisdn:'22170000003', type:'simbox', calls:410, cell:'BTS_TBK_001', dur:[10,45], intl_ratio:0.98, premium_ratio:0.00, short_ratio:0.04, imsi:'608011000003', imei:'350333333333333' },
  { msisdn:'22170000004', type:'simbox', calls:250, cell:'BTS_DKR_003', dur:[25,60], intl_ratio:0.89, premium_ratio:0.03, short_ratio:0.06, imsi:'608011000004', imei:'350444444444444' },
  { msisdn:'22170000005', type:'simbox', calls:380, cell:'BTS_KLD_001', dur:[15,40], intl_ratio:0.96, premium_ratio:0.01, short_ratio:0.03, imsi:'608011000005', imei:'350555555555555' },

  // WANGIRI (70%+ appels < 3s, numéros premium +881/+882)
  { msisdn:'22170000011', type:'wangiri', calls:180, cell:null, dur:[0,2], intl_ratio:0.85, premium_ratio:0.75, short_ratio:0.82, imsi:'608011000011', imei:'350666666666666' },
  { msisdn:'22170000012', type:'wangiri', calls:220, cell:null, dur:[0,3], intl_ratio:0.90, premium_ratio:0.80, short_ratio:0.88, imsi:'608011000012', imei:'350777777777777' },
  { msisdn:'22170000013', type:'wangiri', calls:150, cell:null, dur:[0,2], intl_ratio:0.88, premium_ratio:0.72, short_ratio:0.78, imsi:'608011000013', imei:'350888888888888' },
  { msisdn:'22170000014', type:'wangiri', calls:300, cell:null, dur:[0,1], intl_ratio:0.95, premium_ratio:0.85, short_ratio:0.92, imsi:'608011000014', imei:'350999999999999' },

  // IRSF (80%+ international, durée longue, SVA)
  { msisdn:'22170000021', type:'irsf', calls:90,  cell:null, dur:[180,600], intl_ratio:0.92, premium_ratio:0.88, short_ratio:0.02, imsi:'608011000021', imei:'351111111111111' },
  { msisdn:'22170000022', type:'irsf', calls:65,  cell:null, dur:[240,720], intl_ratio:0.88, premium_ratio:0.82, short_ratio:0.01, imsi:'608011000022', imei:'351222222222222' },
  { msisdn:'22170000023', type:'irsf', calls:120, cell:null, dur:[150,480], intl_ratio:0.95, premium_ratio:0.90, short_ratio:0.03, imsi:'608011000023', imei:'351333333333333' },
  { msisdn:'22170000024', type:'irsf', calls:80,  cell:null, dur:[300,900], intl_ratio:0.85, premium_ratio:0.78, short_ratio:0.02, imsi:'608011000024', imei:'351444444444444' },

  // ATO (comportement post-SIM Swap)
  { msisdn:'22170000031', type:'ato', calls:85,  cell:null, dur:[30,120], intl_ratio:0.55, premium_ratio:0.30, short_ratio:0.15, imsi:'608011000031', imei:'351555555555555', swap:true },
  { msisdn:'22170000032', type:'ato', calls:110, cell:null, dur:[20,90],  intl_ratio:0.60, premium_ratio:0.25, short_ratio:0.12, imsi:'608011000032', imei:'351666666666666', swap:true },
  { msisdn:'22170000033', type:'ato', calls:70,  cell:null, dur:[40,150], intl_ratio:0.70, premium_ratio:0.40, short_ratio:0.10, imsi:'608011000033', imei:'351777777777777', swap:true },

  // NORMAUX (profils légitimes variés)
  { msisdn:'22170000041', type:'normal', calls:12, cell:null, dur:[30,300], intl_ratio:0.05, premium_ratio:0.00, short_ratio:0.08, imsi:'608011000041', imei:'352111111111111' },
  { msisdn:'22170000042', type:'normal', calls:8,  cell:null, dur:[60,400], intl_ratio:0.10, premium_ratio:0.00, short_ratio:0.05, imsi:'608011000042', imei:'352222222222222' },
  { msisdn:'22170000043', type:'normal', calls:25, cell:null, dur:[45,250], intl_ratio:0.08, premium_ratio:0.04, short_ratio:0.10, imsi:'608011000043', imei:'352333333333333' },
  { msisdn:'22170000044', type:'normal', calls:5,  cell:null, dur:[120,600],intl_ratio:0.20, premium_ratio:0.00, short_ratio:0.00, imsi:'608011000044', imei:'352444444444444' },
  { msisdn:'22170000045', type:'normal', calls:18, cell:null, dur:[90,500], intl_ratio:0.00, premium_ratio:0.00, short_ratio:0.06, imsi:'608011000045', imei:'352555555555555' },
  { msisdn:'22170000046', type:'normal', calls:30, cell:null, dur:[30,180], intl_ratio:0.03, premium_ratio:0.00, short_ratio:0.07, imsi:'608011000046', imei:'352666666666666' },
  { msisdn:'22170000047', type:'normal', calls:15, cell:null, dur:[60,300], intl_ratio:0.07, premium_ratio:0.00, short_ratio:0.13, imsi:'608011000047', imei:'352777777777777' },
];

const WANGIRI_PREFIXES = ['+88160','88161','+88162','+88213','+88214','+38241','+35318'];
const IRSF_COUNTRIES = ['+25470','+25571','+35318','+67670','+68810','+88160'];

async function buildCDR(profile) {
  const rows = [];
  const fixedCell = profile.cell || pick(CELLS_LOCAL.slice(0,5));

  for (let i = 0; i < profile.calls; i++) {
    const isShort    = Math.random() < profile.short_ratio;
    const isIntl     = Math.random() < profile.intl_ratio;
    const isPremium  = Math.random() < profile.premium_ratio;
    const dur = isShort ? rnd(0, profile.dur[0] > 3 ? 2 : profile.dur[1]) : rnd(profile.dur[0], profile.dur[1]);

    let msisdn_b, country_code_b;
    if (profile.type === 'wangiri') {
      const prefix = pick(WANGIRI_PREFIXES);
      msisdn_b = prefix + rnd(100000,999999);
      country_code_b = prefix.replace('+','').substring(0,3);
    } else if (profile.type === 'irsf') {
      const prefix = pick(IRSF_COUNTRIES);
      msisdn_b = prefix + rnd(100000,999999);
      country_code_b = prefix.replace('+','').substring(0,3);
    } else if (isIntl) {
      const intlPrefix = pick(['+33','+44','+49','+34','+39']);
      msisdn_b = intlPrefix + rnd(600000000,799999999);
      country_code_b = intlPrefix.replace('+','');
    } else {
      msisdn_b = '221' + rnd(700000000,799999999);
      country_code_b = '221';
    }

    const cell = profile.cell ? profile.cell : pick(CELLS_LOCAL);
    const hoursAgo = rnd(1, 72);

    rows.push({
      id: uid(),
      msisdn_a: profile.msisdn,
      msisdn_b,
      imsi: profile.imsi,
      imei: profile.imei,
      cell_id: cell,
      duration_sec: dur,
      start_time: tsBack(hoursAgo),
      call_type: 'MO',
      is_international: isIntl || profile.type === 'irsf' || profile.type === 'wangiri',
      is_premium: isPremium || (profile.type === 'irsf' && Math.random() < 0.8) || (profile.type === 'wangiri' && Math.random() < 0.7),
      country_code_b: country_code_b || '221',
    });
  }
  return rows;
}

async function main() {
  // 1. Supprimer anciens CDR
  console.log('Suppression anciens CDR...');
  const { error: delErr } = await sb.from('cdr_voice').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) { console.error('Delete error:', delErr.message); process.exit(1); }

  // 2. Supprimer anciens sim_swap
  await sb.from('sim_swap_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 3. Générer et insérer CDR par profil
  let totalInserted = 0;
  for (const profile of PROFILES) {
    const cdrs = await buildCDR(profile);
    // Insérer par batch de 200
    for (let i = 0; i < cdrs.length; i += 200) {
      const batch = cdrs.slice(i, i + 200);
      const { error } = await sb.from('cdr_voice').insert(batch);
      if (error) console.error(`Error ${profile.msisdn}:`, error.message);
      else { totalInserted += batch.length; process.stdout.write('.'); }
    }
    console.log(` ✓ ${profile.msisdn} (${profile.type}) — ${cdrs.length} CDR`);
  }

  // 4. Insérer SIM swaps pour les profils ATO
  const swapRows = [];
  for (const p of PROFILES.filter(p => p.swap)) {
    swapRows.push({
      id: uid(),
      msisdn: p.msisdn,
      old_imsi: p.imsi.replace('1','9'),
      new_imsi: p.imsi,
      old_imei: p.imei.replace('5','9'),
      new_imei: p.imei,
      swap_reason: pick(['Client request','SIM damaged','Lost SIM']),
      swap_channel: pick(['Agence','Self-care','Call center']),
      swapped_at: tsBack(rnd(12, 48)),
    });
    // 2ème swap pour r.msisdn 031 (sim_swap_count > 2)
    if (p.msisdn === '22170000031') {
      swapRows.push({
        id: uid(),
        msisdn: p.msisdn,
        old_imsi: p.imsi.replace('1','8'),
        new_imsi: p.imsi.replace('1','9'),
        old_imei: p.imei.replace('5','8'),
        new_imei: p.imei.replace('5','9'),
        swap_reason: 'SIM damaged',
        swap_channel: 'Agence',
        swapped_at: tsBack(rnd(72, 168)),
      });
    }
  }
  const { error: swapErr } = await sb.from('sim_swap_history').insert(swapRows);
  if (swapErr) console.error('Swap insert error:', swapErr.message);
  else console.log(`✓ ${swapRows.length} SIM swaps insérés`);

  console.log(`\n✅ Total CDR insérés: ${totalInserted}`);
  console.log(`   Profils: ${PROFILES.length} MSISDN (5 SIM Box, 4 Wangiri, 4 IRSF, 3 ATO, 7 normaux)`);
}

main().catch(console.error);
