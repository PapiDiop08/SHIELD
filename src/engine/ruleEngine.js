// ── AAR Telco — Moteur d'évaluation des règles CDR ────────────────────────
// Évaluation stateful : chaque CDR met à jour l'état du MSISDN puis toutes les
// règles actives sont évaluées sur les métriques glissantes (fenêtre 24 h).
//
// Les fenêtres temporelles (1 h, 2 h, 24 h) sont calculées par rapport au
// dernier CDR reçu (et non à l'horloge du navigateur) : le résultat est le même
// en temps réel, en rejeu de fichiers ou en simulation.

const H1 = 3600 * 1000;
const WINDOW_MS = 24 * H1;
const D30 = 30 * 24 * H1;

// ── Listes de référence utilisées par les opérateurs "in" / "match" ─────────
// Indicatifs (3 premiers chiffres après le +) des destinations à risque IRSF
export const REFERENCE_LISTS = {
  irsf_countries:   ['252', '239', '248', '676', '688', '683', '690', '674', '870'],
  wangiri_prefixes: ['+881', '+882', '+883', '+3824', '+3531'],
  fraud_exchange:   ['+67670', '+68810', '+25261', '+88216'],
};

const isNight = (ts) => { const h = new Date(ts).getUTCHours(); return h < 6; }; // Afrique de l'Ouest : UTC+0

export class MsisdnState {
  constructor(msisdn) {
    this.msisdn     = msisdn;
    this.calls      = [];   // { ts, dur, intl, prem, cell, b, countryB, dir }
    this.sms        = [];   // ts des SMS sortants
    this.data       = [];   // { ts, mb, roaming }
    this.recharges  = [];   // { ts, amount }
    this.mmAccess   = [];   // ts des accès au portefeuille mobile money
    this.simSwaps   = [];   // ts des changements de SIM
    this.imeiSeen   = [];   // { ts, imei }
    this.imsiSeen   = [];   // { ts, imsi }
    this.cliSpoofed = 0;    // nb d'appels avec CLI incohérent (signalisation)
    this.lastCdr    = null;
    this.refTs      = 0;
  }

  _purge(now) {
    this.calls     = this.calls.filter(c => now - c.ts <= WINDOW_MS);
    this.sms       = this.sms.filter(t => now - t <= WINDOW_MS);
    this.data      = this.data.filter(d => now - d.ts <= WINDOW_MS);
    this.recharges = this.recharges.filter(r => now - r.ts <= WINDOW_MS);
    this.mmAccess  = this.mmAccess.filter(t => now - t <= WINDOW_MS);
    this.imsiSeen  = this.imsiSeen.filter(x => now - x.ts <= WINDOW_MS);
    this.simSwaps  = this.simSwaps.filter(t => now - t <= D30);
  }

  // Ajoute un CDR (voix) et ses événements annexes éventuels
  addCDR(cdr) {
    const ts = new Date(cdr.start_time).getTime();
    this.refTs = Math.max(this.refTs, ts);
    this._purge(this.refTs);
    this.calls.push({
      ts, dur: Number(cdr.duration_sec) || 0,
      intl: !!cdr.is_international, prem: !!cdr.is_premium,
      cell: cdr.cell_id || null, b: cdr.msisdn_b || null,
      countryB: cdr.country_code_b || null,
      dir: cdr.call_type === 'MT' ? 'in' : 'out',
    });
    if (cdr.imei && (!this.imeiSeen.length || this.imeiSeen[this.imeiSeen.length - 1].imei !== cdr.imei)) this.imeiSeen.push({ ts, imei: cdr.imei });
    if (cdr.imsi && (!this.imsiSeen.length || this.imsiSeen[this.imsiSeen.length - 1].imsi !== cdr.imsi)) this.imsiSeen.push({ ts, imsi: cdr.imsi });
    if (cdr.sms_out)    for (let i = 0; i < cdr.sms_out; i++) this.sms.push(ts);
    if (cdr.data_mb)    this.data.push({ ts, mb: cdr.data_mb, roaming: !!cdr.roaming });
    if (cdr.recharge)   this.recharges.push({ ts, amount: cdr.recharge });
    if (cdr.mm_access)  this.mmAccess.push(ts);
    if (cdr.sim_swap)   this.simSwaps.push(ts);
    if (cdr.cli_spoofed) this.cliSpoofed++;
    if (cdr.call_type !== 'MT') this.lastCdr = cdr;
  }

  addSwap(ts) { this.simSwaps.push(ts); }

  // ── Métriques calculées sur la fenêtre courante ────────────────────────
  get metrics() {
    const now   = this.refTs || Date.now();
    const out   = this.calls.filter(c => c.dir === 'out');
    const inc   = this.calls.filter(c => c.dir === 'in');
    const n     = out.length;
    const safe  = (a, b) => (b > 0 ? a / b : 0);

    const cells     = new Set(out.map(c => c.cell).filter(Boolean)).size;
    const intlArr   = out.filter(c => c.intl);
    const intl      = intlArr.length;
    const prem      = out.filter(c => c.prem).length;
    const short     = out.filter(c => c.dur < 3).length;
    const flash     = out.filter(c => c.dur <= 1).length;
    const zero      = out.filter(c => c.dur === 0).length;
    const totalDur  = out.reduce((s, c) => s + c.dur, 0);
    const avgDur    = safe(totalDur, n);
    const stdDur    = n ? Math.sqrt(out.reduce((s, c) => s + (c.dur - avgDur) ** 2, 0) / n) : 0;
    const avgIntl   = safe(intlArr.reduce((s, c) => s + c.dur, 0), intl);
    const bCount    = {};
    for (const c of out) if (c.b) bCount[c.b] = (bCount[c.b] || 0) + 1;
    const bNums     = Object.keys(bCount).length;
    const maxSameB  = Math.max(0, ...Object.values(bCount));
    const countries = new Set(out.map(c => c.countryB).filter(Boolean)).size;
    const night     = out.filter(c => isNight(c.ts)).length;
    const calls1h   = out.filter(c => now - c.ts <= H1).length;
    const calls2h   = out.filter(c => now - c.ts <= 2 * H1).length;
    const short1h   = out.filter(c => now - c.ts <= H1 && c.dur < 3).length;
    const premPfx   = out.filter(c => c.b && REFERENCE_LISTS.wangiri_prefixes.some(p => c.b.startsWith(p))).length;
    const pbxPrem   = out.filter(c => c.prem && c.intl && isNight(c.ts)).length;

    const cell1h = {}, cell24h = {};
    for (const c of out) {
      if (!c.cell) continue;
      cell24h[c.cell] = (cell24h[c.cell] || 0) + 1;
      if (now - c.ts <= H1) cell1h[c.cell] = (cell1h[c.cell] || 0) + 1;
    }

    // SIM swap et prise de contrôle
    const swaps30d  = this.simSwaps.length;
    const swaps24h  = this.simSwaps.filter(t => now - t <= WINDOW_MS).length;
    const lastSwap  = swaps24h ? Math.max(...this.simSwaps) : null;
    const imeiDistinct = new Set(this.imeiSeen.map(x => x.imei)).size;
    const imeiChanged  = this.imeiSeen.some(x => now - x.ts <= WINDOW_MS) && imeiDistinct > 1;
    const imsiChanges  = Math.max(0, this.imsiSeen.length - 1);
    let newCountriesPostSwap = 0, rechargePostSwap = 0, mmPostSwap = false;
    if (lastSwap) {
      const before = new Set(out.filter(c => c.ts < lastSwap).map(c => c.countryB).filter(Boolean));
      newCountriesPostSwap = new Set(out.filter(c => c.ts >= lastSwap && c.countryB && !before.has(c.countryB)).map(c => c.countryB)).size;
      rechargePostSwap = this.recharges.filter(r => r.ts >= lastSwap && r.ts - lastSwap <= H1).reduce((s, r) => s + r.amount, 0);
      mmPostSwap = this.mmAccess.some(t => t >= lastSwap && t - lastSwap <= 2 * H1);
    }
    const behaviorScore = Math.min(100,
      (imeiChanged ? 40 : 0) + (swaps24h ? 30 : 0) + newCountriesPostSwap * 15 + (mmPostSwap ? 15 : 0));

    const dataMb    = this.data.reduce((s, d) => s + d.mb, 0);
    const roamingMb = this.data.filter(d => d.roaming).reduce((s, d) => s + d.mb, 0);
    const last      = this.lastCdr || {};
    const lastB     = last.msisdn_b || '';

    return {
      // Volumes et vélocité
      call_out_count: n, call_in_count: inc.length,
      call_out_ratio: safe(n, Math.max(inc.length, 1)),
      calls_1h: calls1h, velocity_calls_per_h: calls1h, call_out_2h: calls2h, short_calls_1h: short1h,
      call_out_night: night, call_out_night_count: night, night_call_ratio: safe(night, n),
      // Cellules
      unique_cells: cells, cell_unique_count: cells, cell_fixed_bool: cells === 1 ? 1 : 0,
      cell_call_max_1h: Math.max(0, ...Object.values(cell1h)),
      cell_call_max_24h: Math.max(0, ...Object.values(cell24h)),
      // International et premium
      intl_calls: intl, call_intl_out_count: intl,
      intl_ratio: safe(intl, n), intl_calls_ratio: safe(intl, n), intl_termination_ratio: safe(intl, n),
      premium_calls: prem, call_premium_count: prem, premium_ratio: safe(prem, n),
      intl_premium_ratio: safe(prem, intl), premium_prefix_calls: premPfx, pbx_premium_calls: pbxPrem,
      avg_intl_duration_sec: avgIntl, countries_called_count: countries,
      // Durées
      avg_duration_sec: avgDur, call_avg_duration: avgDur, duration_std_dev: stdDur,
      short_calls: short, call_short_count: short, short_ratio: safe(short, n), short_call_ratio: safe(short, n),
      flash_calls: flash, zero_sec_calls: zero,
      // Correspondants
      distinct_b_24h: bNums, distinct_b_numbers: bNums, distinct_msisdn_24h: bNums, max_calls_same_b: maxSameB,
      // SMS, data, rechargements
      sms_count: this.sms.length, sms_out_count: this.sms.length,
      data_usage_mb: dataMb, data_volume_mb: dataMb, roaming_data_mb: roamingMb,
      recharge_count_24h: this.recharges.length, recharge_post_swap_1h: rechargePostSwap,
      // SIM, équipement, prise de contrôle
      sim_swap_count: swaps30d, sim_swap_30d: swaps30d, sim_swap_24h: swaps24h,
      imei_changes: Math.max(0, imeiDistinct - 1), imei_change_bool: imeiChanged ? 1 : 0,
      imei_changed: imeiChanged, imei_fixed_bool: imeiDistinct <= 1 ? 1 : 0,
      imsi_change_count_24h: imsiChanges, new_country_post_swap: newCountriesPostSwap,
      mm_access_2h: mmPostSwap, behavior_change_score: behaviorScore,
      // Signalisation / CLI
      cli_spoofed: this.cliSpoofed > 0, cli_local_spoofed: this.cliSpoofed > 0,
      // Attributs du dernier appel
      is_international: !!last.is_international,
      country_code_b: last.country_code_b || '',
      prefix_blacklist: lastB, intl_blacklist: lastB,
    };
  }
}

// ── Évaluateur de condition individuelle ──────────────────────────────────
const toNum = (v) => {
  if (v === true || v === 'true') return 1;
  if (v === false || v === 'false') return 0;
  return parseFloat(v);
};

function evalCondition(cond, metrics) {
  const metric = metrics[cond.field];
  if (metric === undefined || metric === null) return false;
  const cmp = (cond.comparator || '').toLowerCase();

  if (cmp === 'in') {
    const list = REFERENCE_LISTS[cond.value] || String(cond.value).split(',').map(s => s.trim());
    return list.includes(String(metric));
  }
  if (cmp === 'match') {
    const list = REFERENCE_LISTS[cond.value] || String(cond.value).split(',').map(s => s.trim());
    return list.some(p => String(metric).startsWith(p));
  }
  if (cmp === 'between') {
    const [a, b] = String(cond.value).split(',').map(Number);
    const m = toNum(metric);
    return m >= a && m <= b;
  }
  const m = toNum(metric), val = toNum(cond.value);
  if (Number.isNaN(m) || Number.isNaN(val)) return false;
  switch (cmp) {
    case '>':  return m > val;
    case '>=': return m >= val;
    case '<':  return m < val;
    case '<=': return m <= val;
    case '=':
    case '==': return m === val;
    case '!=': return m !== val;
    default:   return false;
  }
}

// ── Évaluateur d'une règle (conditions ET/OU) ─────────────────────────────
export function evaluateRule(rule, metrics) {
  const conditions = rule.conditions || [];
  if (conditions.length === 0) return false;
  let result = evalCondition(conditions[0], metrics);
  for (let i = 1; i < conditions.length; i++) {
    const cond = conditions[i];
    const logic = (cond.logic || 'ET').toUpperCase();
    const r = evalCondition(cond, metrics);
    result = (logic === 'OU' || logic === 'OR') ? (result || r) : (result && r);
  }
  return result;
}

// Une règle est évaluable si tous ses champs sont calculés par le moteur
export function isRuleEvaluable(rule, metrics) {
  const conds = rule.conditions || [];
  return conds.length > 0 && conds.every(c => c.field && metrics[c.field] !== undefined);
}

// ── Évaluation d'un CDR contre toutes les règles actives ──────────────────
export function processCDR(cdr, msisdnState, activeRules) {
  msisdnState.addCDR(cdr);
  const metrics   = msisdnState.metrics;
  const triggered = [];
  if (cdr.call_type === 'MT') return { metrics, triggered }; // les appels entrants enrichissent le profil, sans déclencher
  for (const rule of activeRules) {
    if (!rule.active) continue;
    if (rule.scope === 'mobile_money') continue; // jamais de règle Mobile Money sur un CDR télécom
    if (!isRuleEvaluable(rule, metrics)) continue;
    if (evaluateRule(rule, metrics)) triggered.push(rule);
  }
  return { metrics, triggered };
}
