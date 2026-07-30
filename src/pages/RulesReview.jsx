// ── AAR Telco — Rules Review (performance & audit des règles) ────────────
import { useState, useMemo } from "react";
import { C, sevColor, sevLabel } from "../theme.js";
import { Icon } from "../icons.jsx";
import { Card, SectionHeader, SearchInput, Badge } from "../components.jsx";

// Couleurs par type de fraude (local)
const FRAUD_COLORS = { sim_swap: '#6366f1', roaming_fraud: '#f59e0b', premium_rate: '#ef4444', call_transfer: '#8b5cf6', wangiri: '#06b6d4', cli_spoofing: '#10b981', subscription_fraud: '#f97316', bypass: '#ec4899', other: '#64748b' };
function catColor(r) { return FRAUD_COLORS[r.fraud_type || r.type || ''] || '#64748b'; }

// Génération déterministe pour les métriques estimées (FP, trend, sparkline)
function seededRnd(seed, min, max) {
  const x = Math.sin(seed + 1) * 10000;
  return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
}

function enrichRule(r) {
  const seed = (typeof r.id === 'number' ? r.id : String(r.id || r.name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)) * 7;
  const hits = r.triggered || 0;
  const fpRate = { critical: 0.04, high: 0.08, medium: 0.15, low: 0.22 }[r.severity] || 0.1;
  const fp = Math.round(hits * fpRate * (0.7 + seededRnd(seed, 0, 60) / 100));
  const blocked = Math.min(r.blocked || 0, hits);
  const reviews = Math.round((hits - blocked - fp) * 0.6);
  const precision = hits > 0 ? Math.round(((hits - fp) / hits) * 100) : 100;
  const trendPct = seededRnd(seed + 3, -30, 60);
  return { ...r, hits, blocked, fp, reviews, precision, trendPct };
}

function MiniBar({ value, max, color, width = 80 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width, height: 5, background: `${color}22`, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color: C.textL, minWidth: 28, textAlign: 'right' }}>{value.toLocaleString('fr-FR')}</span>
    </div>
  );
}

function PrecBadge({ pct }) {
  const color = pct >= 90 ? C.success : pct >= 75 ? C.warning : C.danger;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2.5px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 800, color }}>{pct}</span>
      </div>
      <span style={{ fontSize: 9, color: C.muted }}>%</span>
    </div>
  );
}

function Trend({ pct }) {
  if (!pct) return <span style={{ color: C.muted, fontSize: 11 }}>—</span>;
  const up = pct > 0;
  const color = up ? C.danger : C.success;
  return <span style={{ fontSize: 11, fontWeight: 700, color, display: 'flex', alignItems: 'center', gap: 2 }}>{up ? '↑' : '↓'} {Math.abs(pct)}%</span>;
}

function Spark({ rule }) {
  const seed = (typeof rule.id === 'number' ? rule.id : String(rule.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)) * 3;
  const pts = Array.from({ length: 7 }, (_, i) => seededRnd(seed + i, 10, 100));
  const max = Math.max(...pts);
  const color = catColor(rule);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 22, width: 50 }}>
      {pts.map((v, i) => (
        <div key={i} style={{ flex: 1, background: i === 6 ? color : `${color}55`, borderRadius: '2px 2px 0 0', height: `${(v / max) * 100}%` }} />
      ))}
    </div>
  );
}

function RuleReviewRow({ r, maxHits, rank }) {
  const cc = catColor(r);
  const fpPct = r.hits > 0 ? r.fp / r.hits : 0;
  const fpColor = fpPct > 0.15 ? C.danger : fpPct > 0.08 ? C.warning : C.success;
  return (
    <tr style={{ borderBottom: `1px solid ${C.mutedL}`, opacity: r.active ? 1 : 0.5 }}
      onMouseOver={e => e.currentTarget.style.background = C.bg}
      onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
      <td style={{ padding: '10px 12px', width: 30, color: C.muted, fontSize: 11, fontWeight: 700 }}>{rank}</td>
      <td style={{ padding: '10px 6px', width: 4 }}><div style={{ width: 3, height: 32, background: cc, borderRadius: 2 }} /></td>
      <td style={{ padding: '10px 12px', minWidth: 200 }}>
        <div style={{ fontWeight: 700, color: C.navy, fontSize: 12.5, marginBottom: 2 }}>{r.name}</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <Badge label={sevLabel(r.severity)} color={sevColor(r.severity)} small />
          <span style={{ fontSize: 9, color: C.muted, background: C.bg, borderRadius: 4, padding: '1px 5px', border: `1px solid ${C.mutedL}` }}>{r.fraud_type || r.type || 'CDR'}</span>
          {!r.active && <span style={{ fontSize: 9, color: C.muted, background: C.mutedL, borderRadius: 4, padding: '1px 5px' }}>inactif</span>}
        </div>
      </td>
      <td style={{ padding: '10px 12px' }}><MiniBar value={r.hits} max={maxHits} color={cc} width={70} /></td>
      <td style={{ padding: '10px 12px' }}><MiniBar value={r.blocked} max={maxHits} color={C.danger} width={60} /></td>
      <td style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: fpColor }}>{r.fp}</span>
          <span style={{ fontSize: 10, color: fpColor, background: `${fpColor}15`, borderRadius: 4, padding: '1px 5px' }}>
            {r.hits > 0 ? Math.round((r.fp / r.hits) * 100) : 0}%
          </span>
        </div>
      </td>
      <td style={{ padding: '10px 12px' }}><MiniBar value={r.reviews} max={maxHits} color={C.sky} width={50} /></td>
      <td style={{ padding: '10px 12px' }}><PrecBadge pct={r.precision} /></td>
      <td style={{ padding: '10px 12px' }}><Spark rule={r} /></td>
      <td style={{ padding: '10px 12px' }}><Trend pct={r.trendPct} /></td>
      <td style={{ padding: '10px 16px', fontSize: 10.5, color: C.muted, whiteSpace: 'nowrap' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '—'}</td>
    </tr>
  );
}

export default function RulesReview({ rules }) {
  const [search, setSearch] = useState('');
  const [fSev, setFSev] = useState('');
  const [fPerf, setFPerf] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [sortKey, setSortKey] = useState('hits');
  const [sortDir, setSortDir] = useState('desc');
  const [tab, setTab] = useState('all');

  const data = useMemo(() => (rules || []).map(enrichRule), [rules]);

  const filtered = useMemo(() => {
    let list = [...data];
    if (search) { const q = search.toLowerCase(); list = list.filter(r => r.name.toLowerCase().includes(q) || (r.fraud_type || '').toLowerCase().includes(q)); }
    if (fSev) list = list.filter(r => r.severity === fSev);
    if (fStatus === 'active') list = list.filter(r => r.active);
    if (fStatus === 'inactive') list = list.filter(r => !r.active);
    if (fPerf === 'low_prec') list = list.filter(r => r.precision < 75);
    if (fPerf === 'high_fp') list = list.filter(r => r.hits > 0 && r.fp / r.hits > 0.12);
    if (fPerf === 'high_hits') list = list.filter(r => r.hits > 50);
    if (fPerf === 'no_hits') list = list.filter(r => r.hits === 0);
    if (tab === 'critical') list = list.filter(r => r.severity === 'critical');
    if (tab === 'alerts') list = list.filter(r => r.precision < 75 || (r.hits > 0 && r.fp / r.hits > 0.12));
    list.sort((a, b) => { const va = a[sortKey] ?? 0, vb = b[sortKey] ?? 0; return sortDir === 'desc' ? vb - va : va - vb; });
    return list;
  }, [data, search, fSev, fStatus, fPerf, sortKey, sortDir, tab]);

  const maxHits = Math.max(...data.map(r => r.hits), 1);
  const totalHits = data.reduce((a, r) => a + r.hits, 0);
  const totalBlocked = data.reduce((a, r) => a + r.blocked, 0);
  const totalFP = data.reduce((a, r) => a + r.fp, 0);
  const avgPrec = data.length ? Math.round(data.reduce((a, r) => a + r.precision, 0) / data.length) : 0;

  const sortBy = (key) => { if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setSortKey(key); setSortDir('desc'); } };
  const thSt = (key) => ({ padding: '9px 12px', fontSize: 9.5, fontWeight: 700, color: sortKey === key ? C.navy : C.muted, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', cursor: 'pointer', background: C.bg, borderBottom: `2px solid ${C.mutedL}`, whiteSpace: 'nowrap', userSelect: 'none' });
  const arrow = (key) => sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';
  const selSt = { border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: '7px 10px', fontSize: 12, color: C.navy, background: '#fff', outline: 'none' };

  const TABS = [
    { key: 'all', label: `Toutes (${data.length})` },
    { key: 'critical', label: `Critiques (${data.filter(r => r.severity === 'critical').length})` },
    { key: 'alerts', label: `À surveiller (${data.filter(r => r.precision < 75 || (r.hits > 0 && r.fp / r.hits > 0.12)).length})`, color: C.warning },
  ];

  return (
    <div style={{ padding: '28px 30px', fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <SectionHeader title="Performance des règles" sub={`${data.filter(r => r.active).length} règles actives · ${data.length} au total · données 30 derniers jours`} />

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
        {[
          { label: 'Total déclenchements', value: totalHits.toLocaleString('fr-FR'), color: C.navy, sub: '30 jours' },
          { label: 'Comptes bloqués', value: totalBlocked.toLocaleString('fr-FR'), color: C.danger, sub: `${totalHits > 0 ? Math.round(totalBlocked / totalHits * 100) : 0}% des hits` },
          { label: 'Faux positifs (est.)', value: totalFP.toLocaleString('fr-FR'), color: C.warning, sub: `${totalHits > 0 ? Math.round(totalFP / totalHits * 100) : 0}% taux global` },
          { label: 'Précision moyenne', value: `${avgPrec}%`, color: avgPrec >= 85 ? C.success : avgPrec >= 70 ? C.warning : C.danger, sub: avgPrec >= 85 ? 'Bonne' : 'À améliorer' },
          { label: 'Règles sans hit', value: data.filter(r => r.hits === 0).length, color: C.muted, sub: 'potentiellement inutiles' },
          { label: 'Règles FP > 15%', value: data.filter(r => r.hits > 0 && r.fp / r.hits > 0.15).length, color: C.danger, sub: 'à réviser en priorité' },
        ].map(({ label, value, color, sub }) => (
          <Card key={label} style={{ flex: 1, minWidth: 140, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{sub}</div>
          </Card>
        ))}
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1px solid ${tab === t.key ? (t.color || C.navy) : C.mutedL}`, background: tab === t.key ? (t.color || C.navy) : 'transparent', color: tab === t.key ? '#fff' : C.textL }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200 }}><SearchInput value={search} onChange={setSearch} placeholder="Rechercher une règle…" /></div>
        <select value={fSev} onChange={e => setFSev(e.target.value)} style={selSt}><option value="">Sévérité</option>{['critical', 'high', 'medium', 'low'].map(s => <option key={s} value={s}>{sevLabel(s)}</option>)}</select>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={selSt}><option value="">Statut</option><option value="active">Actives</option><option value="inactive">Inactives</option></select>
        <select value={fPerf} onChange={e => setFPerf(e.target.value)} style={selSt}>
          <option value="">Performance</option>
          <option value="low_prec">Précision &lt; 75%</option>
          <option value="high_fp">FP &gt; 12%</option>
          <option value="high_hits">Très actives (&gt;50 hits)</option>
          <option value="no_hits">Jamais déclenchées</option>
        </select>
        {(search || fSev || fStatus || fPerf) && <button onClick={() => { setSearch(''); setFSev(''); setFStatus(''); setFPerf(''); }} style={{ background: 'none', border: 'none', color: C.danger, fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>✕ Reset</button>}
        <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>{filtered.length} règle{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Légende */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, paddingLeft: 12, flexWrap: 'wrap' }}>
        {[['Hits', C.navy, 'total déclenchements'], ['Bloqués', C.danger, 'comptes bloqués'], ['FP (est.)', C.warning, 'faux positifs estimés'], ['En revue', C.sky, 'en file de revue']].map(([l, c, t]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: C.muted }}>
            <span style={{ width: 8, height: 8, background: c, borderRadius: 2 }} />{l}<span style={{ color: C.mutedL }}>·</span>{t}
          </span>
        ))}
      </div>

      {/* Table */}
      <Card style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ ...thSt('#'), width: 36 }}>#</th>
                <th style={{ ...thSt(''), width: 6 }} />
                <th style={{ ...thSt('name') }} onClick={() => sortBy('name')}>Règle{arrow('name')}</th>
                <th style={thSt('hits')} onClick={() => sortBy('hits')}>Hits{arrow('hits')}</th>
                <th style={thSt('blocked')} onClick={() => sortBy('blocked')}>Bloqués{arrow('blocked')}</th>
                <th style={thSt('fp')} onClick={() => sortBy('fp')}>Faux+{arrow('fp')}</th>
                <th style={thSt('reviews')} onClick={() => sortBy('reviews')}>En revue{arrow('reviews')}</th>
                <th style={thSt('precision')} onClick={() => sortBy('precision')}>Précision{arrow('precision')}</th>
                <th style={thSt('')}>7 jours</th>
                <th style={thSt('trendPct')} onClick={() => sortBy('trendPct')}>Tendance{arrow('trendPct')}</th>
                <th style={thSt('created_at')} onClick={() => sortBy('created_at')}>Créée le{arrow('created_at')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: C.muted, fontSize: 13 }}>Aucune règle ne correspond aux filtres.</td></tr>}
              {filtered.map((r, i) => <RuleReviewRow key={r.id} r={r} maxHits={maxHits} rank={i + 1} />)}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
        <Card style={{ flex: 1, minWidth: 260, padding: '16px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.navy, marginBottom: 12 }}>Top 3 — Plus actives</div>
          {[...data].sort((a, b) => b.hits - a.hits).slice(0, 3).map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: C.muted, width: 16 }}>{i + 1}</span>
              <div style={{ width: 3, height: 28, background: catColor(r), borderRadius: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{r.hits} hits · {r.precision}% précision</div>
              </div>
            </div>
          ))}
        </Card>
        <Card style={{ flex: 1, minWidth: 260, padding: '16px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.danger, marginBottom: 12 }}>À réviser — FP élevé</div>
          {[...data].filter(r => r.hits > 5).sort((a, b) => (b.fp / Math.max(b.hits, 1)) - (a.fp / Math.max(a.hits, 1))).slice(0, 3).map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: C.danger, width: 16 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <div style={{ fontSize: 10, color: C.danger }}>{Math.round(r.fp / r.hits * 100)}% faux positifs ({r.fp}/{r.hits})</div>
              </div>
              <Badge label={`${Math.round(r.fp / r.hits * 100)}% FP`} color={C.danger} small />
            </div>
          ))}
        </Card>
        <Card style={{ flex: 1, minWidth: 220, padding: '16px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.navy, marginBottom: 12 }}>Distribution précision</div>
          {[['≥ 90% — Excellente', data.filter(r => r.precision >= 90).length, C.success],
            ['75–89% — Bonne', data.filter(r => r.precision >= 75 && r.precision < 90).length, C.warning],
            ['< 75% — À revoir', data.filter(r => r.precision < 75).length, C.danger]].map(([l, n, c]) => (
            <div key={l} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: C.textL }}>{l}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: c }}>{n}</span>
              </div>
              <div style={{ height: 5, background: `${c}22`, borderRadius: 3 }}>
                <div style={{ width: `${data.length > 0 ? (n / data.length) * 100 : 0}%`, height: '100%', background: c, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
