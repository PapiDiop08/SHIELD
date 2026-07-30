// ── AAR Telco — Moteur d'évaluation des règles CDR ────────────────────────
// Évaluation stateful : chaque CDR met à jour l'état MSISDN et évalue les règles

// ── État glissant par MSISDN (fenêtre 24h) ────────────────────────────────
const WINDOW_MS = 24 * 3600 * 1000; // 24h

export class MsisdnState {
  constructor(msisdn) {
    this.msisdn      = msisdn;
    this.calls       = [];       // { ts, dur, intl, prem, cell, msisdn_b }
    this.simSwaps    = [];       // timestamps de SIM swaps
    this.imeiHistory = new Set();
    this.imsiHistory = new Set();
  }

  // Ajoute un CDR et purge les entrées hors fenêtre
  addCDR(cdr) {
    const now = new Date(cdr.start_time).getTime();
    // Purger > 24h
    this.calls = this.calls.filter(c => now - c.ts <= WINDOW_MS);
    this.calls.push({
      ts:     now,
      dur:    cdr.duration_sec || 0,
      intl:   cdr.is_international || false,
      prem:   cdr.is_premium || false,
      cell:   cdr.cell_id,
      b:      cdr.msisdn_b,
    });
    if (cdr.imei) this.imeiHistory.add(cdr.imei);
    if (cdr.imsi) this.imsiHistory.add(cdr.imsi);
  }

  addSwap(ts) { this.simSwaps.push(ts); }

  // ── Métriques calculées sur la fenêtre courante ────────────────────────
  get metrics() {
    const n         = this.calls.length;
    if (n === 0) return this._emptyMetrics();
    const cells     = new Set(this.calls.map(c => c.cell)).size;
    const intl      = this.calls.filter(c => c.intl).length;
    const prem      = this.calls.filter(c => c.prem).length;
    const short     = this.calls.filter(c => c.dur < 3).length;
    const totalDur  = this.calls.reduce((s, c) => s + c.dur, 0);
    const avgDur    = totalDur / n;
    const bNums     = new Set(this.calls.map(c => c.b)).size;
    // Fenêtre 1h pour vélocité
    const now       = Date.now();
    const calls1h   = this.calls.filter(c => now - c.ts <= 3600000).length;
    const swapsRecent = this.simSwaps.filter(t => now - t <= 30 * 86400000).length;
    const swaps24h    = this.simSwaps.filter(t => now - t <= 86400000).length;

    return {
      call_out_count:    n,
      unique_cells:      cells,
      intl_calls:        intl,
      intl_ratio:        intl / n,
      premium_calls:     prem,
      premium_ratio:     prem / n,
      short_calls:       short,
      short_ratio:       short / n,
      avg_duration_sec:  avgDur,
      distinct_b_24h:    bNums,
      calls_1h:          calls1h,
      sim_swap_count:    swapsRecent,
      sim_swap_24h:      swaps24h,
      imei_changes:      this.imeiHistory.size - 1,
    };
  }

  _emptyMetrics() {
    return { call_out_count:0, unique_cells:0, intl_calls:0, intl_ratio:0,
      premium_calls:0, premium_ratio:0, short_calls:0, short_ratio:0,
      avg_duration_sec:0, distinct_b_24h:0, calls_1h:0,
      sim_swap_count:0, sim_swap_24h:0, imei_changes:0 };
  }
}

// ── Évaluateur de condition individuelle ──────────────────────────────────
function evalCondition(cond, metrics) {
  const val    = parseFloat(cond.value);
  const metric = metrics[cond.field];
  if (metric === undefined) return false;

  switch (cond.comparator) {
    case '>':        return metric > val;
    case '>=':       return metric >= val;
    case '<':        return metric < val;
    case '<=':       return metric <= val;
    case '=':
    case '==':       return metric == val;  // eslint-disable-line
    case 'between': {
      const [a, b] = cond.value.split(',').map(Number);
      return metric >= a && metric <= b;
    }
    default:         return false;
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
    const condResult = evalCondition(cond, metrics);
    if (logic === 'OU') result = result || condResult;
    else                result = result && condResult;
  }
  return result;
}

// ── Évaluation d'un CDR contre toutes les règles actives ──────────────────
// Retourne la liste des règles déclenchées
export function processCDR(cdr, msisdnState, activeRules) {
  msisdnState.addCDR(cdr);
  const metrics   = msisdnState.metrics;
  const triggered = [];

  for (const rule of activeRules) {
    if (!rule.active) continue;
    // Scope : seulement les règles Telco
    if (rule.scope && rule.scope !== 'telco') continue;
    // Types conditions CDR uniquement
    const hasCdrConds = (rule.conditions || []).some(c => c.type === 'cdr' || c.type === 'velocity');
    if (!hasCdrConds) continue;

    if (evaluateRule(rule, metrics)) {
      triggered.push(rule);
    }
  }
  return { metrics, triggered };
}
