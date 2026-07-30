// ── AAR Telco — Simulateur flux CDR opérateur temps réel ─────────────────
// Génère uniquement des appels voix (CDR) — 50% fraud / 50% légit
// Évalue les règles statefully et écrit en base Supabase

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { C } from "../theme.js";
import { Card, Btn } from "../components.jsx";
import { MsisdnState, processCDR } from "../engine/ruleEngine.js";
import { createBatchSequence, FRAUD_PROFILES, LEGIT_PROFILES } from "../engine/cdrGenerator.js";
import { supabase } from "../supabase.js";

const fmtTime = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit", second:"2-digit" });
const FRAUD_COLOR = { simbox: C.danger, wangiri: "#e67e22", irsf: "#8e44ad", ato: "#c0392b" };

function StatusBadge({ type }) {
  const colors = { FRAUD: C.danger, ALERT: "#e67e22", OK: C.success };
  const labels = { FRAUD: "⛔ BLOQUÉ", ALERT: "⚠️ ALERTE", OK: "✓ OK" };
  return (
    <span style={{ fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:20,
      background:colors[type]+"22", color:colors[type], border:`1px solid ${colors[type]}55` }}>
      {labels[type]}
    </span>
  );
}

function CdrRow({ entry, idx }) {
  const { cdr, profile, result, status, triggeredRule } = entry;
  const typeColor = profile.type ? (FRAUD_COLOR[profile.type] || C.warning) : C.success;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"50px 110px 130px 100px 55px 55px 50px 50px 1fr 120px",
      gap:6, alignItems:"center", padding:"6px 12px",
      background: status==="FRAUD"?"#fef0f0": status==="ALERT"?"#fff8ec":"#f8fffe",
      borderBottom:`1px solid ${C.mutedL}`, fontSize:11,
      borderLeft:`3px solid ${status==="FRAUD"?C.danger:status==="ALERT"?"#e67e22":C.success}`,
      animation: idx===0?"fadeIn 0.3s ease":"none" }}>
      <span style={{ color:C.muted, fontSize:10 }}>{fmtTime(cdr.start_time)}</span>
      <span style={{ fontFamily:"monospace", fontSize:10, fontWeight:700, color:typeColor }}>
        {profile.id} · {profile.label?.split(" ")[0]}
      </span>
      <span style={{ fontFamily:"monospace", fontSize:10 }}>{cdr.msisdn_a}</span>
      <span style={{ fontFamily:"monospace", fontSize:10, color:C.muted }}>{cdr.msisdn_b?.slice(0,14)}</span>
      <span style={{ color:cdr.duration_sec<3?C.danger:C.navy, fontWeight:cdr.duration_sec<3?700:400 }}>{cdr.duration_sec}s</span>
      <span style={{ color:cdr.is_international?C.warning:C.muted, fontSize:10 }}>{cdr.is_international?"INTL":"LOCAL"}</span>
      <span style={{ color:cdr.is_premium?"#8e44ad":C.muted, fontSize:10 }}>{cdr.is_premium?"SVA":"—"}</span>
      <span style={{ color:C.muted, fontSize:10 }}>{cdr.cell_id?.slice(-3)||"—"}</span>
      <span style={{ color:C.muted, fontSize:10 }}>
        {result ? `${result.metrics.call_out_count} app · ${result.metrics.unique_cells} cell · ${Math.round(result.metrics.short_ratio*100)}% courts` : "—"}
      </span>
      <div style={{ display:"flex", gap:4, alignItems:"center", justifyContent:"flex-end" }}>
        <StatusBadge type={status} />
        {triggeredRule && <span style={{ fontSize:9, color:C.danger, maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{triggeredRule.name}</span>}
      </div>
    </div>
  );
}

function StatsPanel({ stats }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:8, marginBottom:16 }}>
      {[
        ["CDR reçus",  stats.total,   C.navy],
        ["Légitimes",  stats.legit,   C.success],
        ["Alertes",    stats.alerts,  "#e67e22"],
        ["Bloqués",    stats.blocked, C.danger],
        ["SIM Box",    stats.simbox,  C.danger],
        ["Wangiri",    stats.wangiri, "#e67e22"],
        ["IRSF",       stats.irsf,    "#8e44ad"],
      ].map(([label,val,color]) => (
        <div key={label} style={{ background:C.bg, borderRadius:8, padding:"8px 12px", borderLeft:`3px solid ${color}` }}>
          <div style={{ fontSize:18, fontWeight:800, color }}>{val}</div>
          <div style={{ fontSize:10, color:C.muted }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

export default function CdrSimulator({ rules = [], addAlert }) {
  const [running,   setRunning]   = useState(false);
  const [feed,      setFeed]      = useState([]);
  const [stats,     setStats]     = useState({ total:0, legit:0, alerts:0, blocked:0, simbox:0, wangiri:0, irsf:0, ato:0 });
  const [speed,     setSpeed]     = useState(300);
  const [batchSize, setBatchSize] = useState(3);
  const [batchMode, setBatchMode] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  const stateMap = useRef({});
  const timerRef = useRef(null);
  const seqRef   = useRef(null);
  const feedRef  = useRef([]);
  const statsRef = useRef({ total:0, legit:0, alerts:0, blocked:0, simbox:0, wangiri:0, irsf:0, ato:0 });
  const activeRulesRef = useRef([]);

  useEffect(() => {
    activeRulesRef.current = (rules||[]).filter(r => r.active && r.scope==='telco');
  }, [rules]);

  const rulesCount = useMemo(() => (rules||[]).filter(r=>r.active&&r.scope==='telco').length, [rules]);

  const handleCDR = useCallback(async ({ cdr, profile }) => {
    if (!stateMap.current[cdr.msisdn_a]) {
      stateMap.current[cdr.msisdn_a] = new MsisdnState(cdr.msisdn_a);
    }
    const state  = stateMap.current[cdr.msisdn_a];
    const result = processCDR(cdr, state, activeRulesRef.current);
    const triggered  = result.triggered;
    const topRule    = triggered.find(r => r.action==='block') || triggered[0];
    const status     = topRule?.action==='block' ? 'FRAUD' : triggered.length>0 ? 'ALERT' : 'OK';

    // Écrire CDR en DB
    supabase.from('cdr_voice').insert({
      msisdn_a: cdr.msisdn_a, msisdn_b: cdr.msisdn_b,
      imsi: cdr.imsi, imei: cdr.imei, cell_id: cdr.cell_id,
      duration_sec: cdr.duration_sec, start_time: cdr.start_time,
      call_type: cdr.call_type || 'MO',
      is_international: cdr.is_international, is_premium: cdr.is_premium,
      country_code_b: cdr.country_code_b,
    }).then(() => {});

    // Créer alerte si règle déclenchée
    if (topRule) {
      const alertRow = {
        msisdn: cdr.msisdn_a, imsi: cdr.imsi, imei: cdr.imei,
        fraud_type: topRule.name, type: profile.type?.toUpperCase() || 'DETECTION',
        status: topRule.action==='block' ? 'blocked' : 'open',
        score: Math.min(100, 60 + triggered.length * 15),
        severity: topRule.severity || 'high',
        reason: `Règle "${topRule.name}" — ${topRule.description||''}`,
        date: new Date().toISOString(), created_at: new Date().toISOString(),
        amount: 0, tx_count_24h: result.metrics.call_out_count,
        velocity_24h: result.metrics.call_out_count,
      };
      supabase.from('alerts').insert(alertRow).select().then(({ data }) => {
        if (data?.[0] && addAlert) addAlert(data[0]);
      });
    }

    // Feed + stats
    const entry = { cdr, profile, result, status, triggeredRule: topRule, id: Date.now()+Math.random() };
    feedRef.current = [entry, ...feedRef.current].slice(0, 200);
    setFeed([...feedRef.current]);

    const s = statsRef.current;
    s.total++;
    if (status==='OK')    s.legit++;
    if (status==='ALERT') s.alerts++;
    if (status==='FRAUD') s.blocked++;
    if (profile.type==='simbox')  s.simbox++;
    if (profile.type==='wangiri') s.wangiri++;
    if (profile.type==='irsf')    s.irsf++;
    if (profile.type==='ato')     s.ato++;
    statsRef.current = { ...s };
    setStats({ ...s });
  }, [addAlert]);

  const tick = useCallback(() => {
    if (!seqRef.current) seqRef.current = createBatchSequence();
    for (let i = 0; i < batchSize; i++) handleCDR(seqRef.current());
  }, [handleCDR, batchSize]);

  const start = () => {
    if (running) return;
    seqRef.current = createBatchSequence();
    setRunning(true);
    timerRef.current = setInterval(tick, speed);
  };

  const pause = () => { setRunning(false); clearInterval(timerRef.current); };

  const reset = () => {
    pause();
    stateMap.current = {};
    seqRef.current   = null;
    feedRef.current  = [];
    statsRef.current = { total:0, legit:0, alerts:0, blocked:0, simbox:0, wangiri:0, irsf:0, ato:0 };
    setFeed([]);
    setStats({ ...statsRef.current });
    setBatchProgress(0);
  };

  // Batch 300 CDR
  const generateBatch = useCallback(async () => {
    if (batchMode) return;
    setBatchMode(true);
    setBatchProgress(0);
    const seq   = createBatchSequence();
    const TOTAL = 300;
    for (let i = 0; i < TOTAL; i += 5) {
      const promises = [];
      for (let j = 0; j < 5 && i+j < TOTAL; j++) promises.push(handleCDR(seq()));
      await Promise.all(promises);
      setBatchProgress(Math.min(100, Math.round(((i+5)/TOTAL)*100)));
      await new Promise(r => setTimeout(r, 50));
    }
    setBatchMode(false);
    setBatchProgress(100);
  }, [batchMode, handleCDR]);

  useEffect(() => {
    if (running) {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(tick, speed);
    }
    return () => clearInterval(timerRef.current);
  }, [speed, running, tick]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const fraudRate = stats.total>0 ? Math.round(((stats.blocked+stats.alerts)/stats.total)*100) : 0;

  return (
    <div style={{ padding:"24px 32px", fontFamily:"DM Sans, sans-serif" }}>
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:none } }`}</style>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:C.navy }}>
            Simulateur CDR — Flux opérateur temps réel
          </h2>
          <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>
            Appels voix uniquement · {rulesCount} règles actives · 50% fraud / 50% légit
          </p>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <select value={speed} onChange={e => setSpeed(Number(e.target.value))}
            style={{ border:`1px solid ${C.mutedL}`, borderRadius:6, padding:"4px 8px", fontSize:11 }}>
            <option value={2000}>Lent (2s)</option>
            <option value={800}>Normal (0.8s)</option>
            <option value={300}>Rapide (0.3s)</option>
            <option value={100}>Très rapide</option>
          </select>
          <select value={batchSize} onChange={e => setBatchSize(Number(e.target.value))}
            style={{ border:`1px solid ${C.mutedL}`, borderRadius:6, padding:"4px 8px", fontSize:11 }}>
            <option value={1}>1 CDR/tick</option>
            <option value={3}>3 CDR/tick</option>
            <option value={5}>5 CDR/tick</option>
          </select>
          <Btn onClick={reset} variant="outline" small>Réinitialiser</Btn>
          <Btn onClick={generateBatch} disabled={batchMode} variant="outline" small
            style={{ background:"#f3e8ff", color:"#7c3aed", borderColor:"#7c3aed" }}>
            {batchMode ? `⏳ ${batchProgress}%` : "⚡ Générer 300 CDR"}
          </Btn>
          {running
            ? <Btn onClick={pause} variant="outline" small style={{ color:C.warning, borderColor:C.warning }}>⏸ Pause</Btn>
            : <Btn onClick={start} variant="navy" small>▶ Démarrer le flux</Btn>
          }
        </div>
      </div>

      {/* Barre de progression batch */}
      {batchMode && (
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, color:"#7c3aed", marginBottom:4 }}>Génération — {batchProgress}% ({Math.round(batchProgress*3)}/300 CDR)</div>
          <div style={{ height:6, background:C.mutedL, borderRadius:4 }}>
            <div style={{ width:`${batchProgress}%`, height:"100%", background:"#7c3aed", borderRadius:4, transition:"width 0.1s" }} />
          </div>
        </div>
      )}

      <StatsPanel stats={stats} />

      {stats.total>0 && (
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
          <span style={{ fontSize:12, color:C.muted }}>Taux de détection</span>
          <div style={{ flex:1, height:6, background:C.mutedL, borderRadius:4 }}>
            <div style={{ width:`${fraudRate}%`, height:"100%", background:C.danger, borderRadius:4, transition:"width 0.3s" }} />
          </div>
          <span style={{ fontSize:12, fontWeight:700, color:C.danger }}>{fraudRate}%</span>
          <span style={{ fontSize:12, color:C.muted }}>sur {stats.total} CDR</span>
        </div>
      )}

      <Card style={{ padding:0, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"50px 110px 130px 100px 55px 55px 50px 50px 1fr 120px",
          gap:6, padding:"8px 12px", background:C.bg, borderBottom:`2px solid ${C.mutedL}`,
          fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase" }}>
          <span>Heure</span><span>Profil</span><span>MSISDN A</span><span>MSISDN B</span>
          <span>Durée</span><span>Type</span><span>SVA</span><span>Cell</span>
          <span>État 24h</span><span style={{ textAlign:"right" }}>Résultat</span>
        </div>
        <div style={{ maxHeight:520, overflowY:"auto" }}>
          {feed.length===0 ? (
            <div style={{ padding:"60px 24px", textAlign:"center", color:C.muted }}>
              <div style={{ fontSize:32, marginBottom:12 }}>📡</div>
              <div style={{ fontSize:14, fontWeight:600 }}>En attente du flux CDR</div>
              <div style={{ fontSize:12, marginTop:6 }}>
                <b>⚡ Générer 300 CDR</b> pour un batch immédiat · <b>▶ Démarrer</b> pour le flux continu
              </div>
            </div>
          ) : feed.map((entry,idx) => <CdrRow key={entry.id} entry={entry} idx={idx} />)}
        </div>
      </Card>

      <div style={{ marginTop:12, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontSize:11, color:C.muted }}>Profils :</span>
        {[...FRAUD_PROFILES,...LEGIT_PROFILES].map(p => (
          <span key={p.id} style={{ fontSize:10, padding:"2px 8px", borderRadius:12,
            background:(p.type?(FRAUD_COLOR[p.type]||C.warning):C.success)+"22",
            color:p.type?(FRAUD_COLOR[p.type]||C.warning):C.success,
            border:`1px solid ${(p.type?(FRAUD_COLOR[p.type]||C.warning):C.success)}44` }}>
            {p.id} · {p.label}
          </span>
        ))}
      </div>
      <div style={{ marginTop:8, fontSize:11, color:C.muted }}>
        💡 Après génération, allez dans <b>Détections</b> pour voir les alertes créées en temps réel.
      </div>
    </div>
  );
}
