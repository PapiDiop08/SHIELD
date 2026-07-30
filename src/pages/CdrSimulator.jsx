// ── AAR Telco — Simulateur flux CDR opérateur temps réel ─────────────────
// Génère CDR voix + Plaintes + Distributeurs SIM suspects

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { C } from "../theme.js";
import { Card, Btn } from "../components.jsx";
import { MsisdnState, processCDR } from "../engine/ruleEngine.js";
import { createBatchSequence, prewarmStates, FRAUD_PROFILES, LEGIT_PROFILES } from "../engine/cdrGenerator.js";
import { supabase } from "../supabase.js";

const fmtTime = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit", second:"2-digit" });

const FRAUD_TYPE_MAP = {
  simbox: "SIM Box",
  wangiri: "Wangiri",
  irsf: "IRSF",
  ato: "ATO",
};

const FRAUD_REASONS = {
  simbox: "SIM Box détectée — trafic international exclusif, rotation IMEI suspecte",
  wangiri: "Wangiri — appels manqués internationaux courts (< 3s) en masse",
  irsf: "IRSF — terminaison vers numéros SVA/premium internationaux",
  ato: "ATO — prise de contrôle compte, comportement anormal post-changement SIM",
};

const FRAUD_COLOR = { simbox: C.danger, wangiri: "#e67e22", irsf: "#8e44ad", ato: "#c0392b" };

// ── Données synthétiques pour Plaintes ────────────────────────────────────
const COMPLAINT_TEMPLATES = [
  { tag:"Wangiri", fraud_type:"Wangiri", raw:"J'ai reçu un appel manqué du +25470XXXXXX, j'ai rappelé et j'ai été débité immédiatement sans parler à personne.", msisdn_reported: () => `+254${70+Math.floor(Math.random()*10)}${String(Math.floor(Math.random()*9999999)).padStart(7,'0')}` },
  { tag:"Wangiri", fraud_type:"Wangiri", raw:"Appel manqué d'un numéro international africain. Dès le rappel, la communication a duré 1 seconde et j'ai perdu 2000 XOF.", msisdn_reported: () => `+23370${String(Math.floor(Math.random()*9999999)).padStart(7,'0')}` },
  { tag:"Arnaque marabout", fraud_type:"Arnaque", raw:"Un individu se faisant passer pour un marabout m'a contacté et m'a demandé d'envoyer de l'argent via Mobile Money pour un rituel. Numéro utilisé: 221${Math.floor(Math.random()*9000000+1000000)}", msisdn_reported: () => `221${Math.floor(Math.random()*9000000+70000000)}` },
  { tag:"Phishing", fraud_type:"Phishing", raw:"J'ai reçu un SMS prétendant venir de mon opérateur me demandant de confirmer mes données bancaires via un lien suspect.", msisdn_reported: () => null },
  { tag:"Arnaque marabout", fraud_type:"Arnaque", raw:"Quelqu'un m'a appelé en se faisant passer pour un agent de l'opérateur et m'a demandé mon code PIN et des transferts d'argent.", msisdn_reported: () => `221${Math.floor(Math.random()*9000000+70000000)}` },
  { tag:"Fraude", fraud_type:"SIM Box", raw:"Je suis victime d'usurpation. Mon numéro a été utilisé pour des appels internationaux que je n'ai pas effectués.", msisdn_reported: () => `221770${String(Math.floor(Math.random()*999999)).padStart(6,'0')}` },
  { tag:"Fraude", fraud_type:"ATO", raw:"Mon compte a été piraté. Des transferts non autorisés ont été effectués depuis mon numéro après un échange de SIM.", msisdn_reported: () => `221${Math.floor(Math.random()*9000000+76000000)}` },
  { tag:"Harcèlement", fraud_type:"Spam", raw:"Je reçois des dizaines d'appels par jour d'un même numéro qui raccroche immédiatement dès que je décroche.", msisdn_reported: () => `+225${Math.floor(Math.random()*9999999+1000000)}` },
  { tag:"Escroquerie", fraud_type:"Arnaque", raw:"On m'a dit que j'avais gagné un prix et qu'il fallait payer des frais d'envoi via Orange Money. J'ai perdu 15000 XOF.", msisdn_reported: () => `221${Math.floor(Math.random()*9000000+77000000)}` },
  { tag:"Phishing", fraud_type:"IRSF", raw:"J'ai cliqué sur un lien reçu par SMS et mon solde a été débité automatiquement pour des abonnements que je n'ai pas demandés.", msisdn_reported: () => null },
];

// ── Données synthétiques pour Distributeurs SIM ───────────────────────────
const CITIES = ["Dakar", "Pikine", "Guédiawaye", "Thiès", "Ziguinchor", "Saint-Louis", "Kaolack", "Mbour", "Touba", "Diourbel"];
const DIST_TYPES = ["Revendeur agréé", "Revendeur indépendant", "Grossiste", "Kiosque"];
const DIST_NAMES = ["Télécom Express", "SIM Point", "Africa Connect", "Digital Plus", "Mobile Hub", "Net Services", "Dial Shop", "Comm Center", "TelePro", "SimBox Store", "UniTel", "Fast Connect"];

function genDistributor(fraudLevel) {
  const isSuspect = fraudLevel > 0.5;
  const simsSold = Math.floor(Math.random() * 500 + 50);
  const fraudSims = isSuspect ? Math.floor(simsSold * (0.3 + Math.random() * 0.5)) : Math.floor(simsSold * Math.random() * 0.05);
  const fraudRate = fraudSims / simsSold;
  const riskScore = Math.round(fraudRate * 100 + (isSuspect ? 20 : 0));
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];
  const name = DIST_NAMES[Math.floor(Math.random() * DIST_NAMES.length)] + (isSuspect ? " (suspect)" : "");
  return {
    id: crypto.randomUUID(),
    distributor_id: `DIST-${String(Math.floor(Math.random()*9000+1000))}`,
    name,
    type: DIST_TYPES[Math.floor(Math.random() * DIST_TYPES.length)],
    city,
    operator: "AAR Telco",
    country: "Sénégal",
    sims_sold: simsSold,
    fraud_sims: fraudSims,
    fraud_rate: parseFloat(fraudRate.toFixed(4)),
    flagged: isSuspect,
    risk_score: Math.min(100, riskScore),
    created_at: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
  };
}

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
        {triggeredRule && <span style={{ fontSize:9, color:C.danger, maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{FRAUD_TYPE_MAP[profile.type]||triggeredRule.name}</span>}
      </div>
    </div>
  );
}

function StatsPanel({ stats }) {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:8, marginBottom:16 }}>
      {[
        ["CDR reçus",   stats.total,       C.navy],
        ["Légitimes",   stats.legit,       C.success],
        ["Alertes",     stats.alerts,      "#e67e22"],
        ["Bloqués",     stats.blocked,     C.danger],
        ["SIM Box",     stats.simbox,      C.danger],
        ["Wangiri",     stats.wangiri,     "#e67e22"],
        ["IRSF",        stats.irsf,        "#8e44ad"],
        ["ATO",         stats.ato,         "#c0392b"],
      ].map(([label,val,color]) => (
        <div key={label} style={{ background:C.bg, borderRadius:8, padding:"8px 12px", borderLeft:`3px solid ${color}` }}>
          <div style={{ fontSize:18, fontWeight:800, color }}>{val}</div>
          <div style={{ fontSize:10, color:C.muted }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

export default function CdrSimulator({ rules = [], addAlert, currentOperator }) {
  const [running,   setRunning]   = useState(false);
  const [feed,      setFeed]      = useState([]);
  const [stats,     setStats]     = useState({ total:0, legit:0, alerts:0, blocked:0, simbox:0, wangiri:0, irsf:0, ato:0 });
  const [speed,     setSpeed]     = useState(300);
  const [batchSize, setBatchSize] = useState(3);
  const [batchMode, setBatchMode] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchLog,  setBatchLog]  = useState([]);

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

    // Créer alerte avec fraud_type basé sur le profil (pas juste la règle)
    if (topRule) {
      const fraudType = FRAUD_TYPE_MAP[profile.type] || topRule.name;
      const alertRow = {
        id: crypto.randomUUID(),
        msisdn: cdr.msisdn_a,
        type: profile.type || fraudType,
        fraud_type: fraudType,
        status: topRule.action==='block' ? 'blocked' : 'open',
        score: Math.min(100, 60 + triggered.length * 15),
        severity: profile.type === 'irsf' ? 'critical' : topRule.severity || 'high',
        reason: FRAUD_REASONS[profile.type] || `Règle "${topRule.name}"`,
        date: new Date().toISOString().slice(0, 10),
        operator: currentOperator?.name || 'AAR Telco',
        operator_id: currentOperator?.id || null,
        created_at: new Date().toISOString(),
      };
      supabase.from('alerts').insert(alertRow).select().then(({ data, error }) => {
        if (error) console.error('Alert insert error:', error);
        // Subscription Realtime gère l'affichage — pas d'appel addAlert direct
      });

      // ── Auto-blocage : dès que la règle dit "block" → écriture dans blockings
      if (topRule.action === 'block') {
        const blockRow = {
          id: crypto.randomUUID(),
          msisdn: cdr.msisdn_a,
          reason: FRAUD_REASONS[profile.type] || `Règle "${topRule.name}" — score élevé`,
          source: 'shield_auto',
          active: true,
          operator: 'AAR Telco',
          operator_id: currentOperator?.id || null,
          auto_flagged: [topRule.name],
          created_at: new Date().toISOString(),
        };
        supabase.from('blockings').insert(blockRow).then(({ error: bErr }) => {
          if (bErr && !bErr.message?.includes('unique')) console.error('Blocking insert error:', bErr);
        });
      }
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
    // L'interval est géré par le useEffect [speed, running, tick] ci-dessous
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
    setBatchLog([]);
  };

  // ── Génération complète : CDR + Plaintes + Distributeurs ─────────────────
  const generateAll = useCallback(async () => {
    if (batchMode) return;
    setBatchMode(true);
    setBatchProgress(0);
    setBatchLog([]);
    const log = (msg) => setBatchLog(p => [...p, msg]);

    // 0. Pré-chauffe — 60 CDR synthétiques par MSISDN fraud (sans DB)
    log("🔥 Pré-chauffe état MSISDN (60 appels/profil)...");
    prewarmStates(stateMap.current, MsisdnState, 60);

    // 1. CDR — 300 appels
    log("📡 Génération 300 CDR voix...");
    const seq = createBatchSequence();
    const TOTAL_CDR = 300;
    for (let i = 0; i < TOTAL_CDR; i += 5) {
      const promises = [];
      for (let j = 0; j < 5 && i+j < TOTAL_CDR; j++) promises.push(handleCDR(seq()));
      await Promise.all(promises);
      setBatchProgress(Math.round(((i+5)/TOTAL_CDR) * 50)); // 0→50%
      await new Promise(r => setTimeout(r, 40));
    }
    log(`✅ ${TOTAL_CDR} CDR générés`);

    // 2. Plaintes — 40 plaintes variées
    log("📋 Génération 40 plaintes clients...");
    const TOTAL_COMPLAINTS = 40;
    for (let i = 0; i < TOTAL_COMPLAINTS; i += 5) {
      const batch = [];
      for (let j = 0; j < 5 && i+j < TOTAL_COMPLAINTS; j++) {
        const tpl = COMPLAINT_TEMPLATES[Math.floor(Math.random() * COMPLAINT_TEMPLATES.length)];
        batch.push({
          id: crypto.randomUUID(),
          msisdn: `221${Math.floor(Math.random()*9000000+70000000)}`, // numéro de la victime
          msisdn_reported: tpl.msisdn_reported(),
          tag: tpl.tag,
          fraud_type: tpl.fraud_type,
          raw: tpl.raw,
          status: ['open','investigating','closed'][Math.floor(Math.random()*3)],
          auto_blocked: Math.random() > 0.7,
          operator_id: currentOperator?.id || null,
          created_at: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
        });
      }
      await supabase.from('complaints').insert(batch);
      setBatchProgress(50 + Math.round(((i+5)/TOTAL_COMPLAINTS) * 25)); // 50→75%
      await new Promise(r => setTimeout(r, 50));
    }
    log(`✅ ${TOTAL_COMPLAINTS} plaintes insérées`);

    // 3. Distributeurs SIM — 20 distributeurs (dont suspects)
    log("🏪 Génération 20 distributeurs SIM...");
    const TOTAL_DIST = 20;
    for (let i = 0; i < TOTAL_DIST; i += 5) {
      const batch = [];
      for (let j = 0; j < 5 && i+j < TOTAL_DIST; j++) {
        // 40% suspects (fraud_level > 0.5), 60% normaux
        batch.push(genDistributor(j < 2 ? 0.8 : Math.random() * 0.3));
      }
      await supabase.from('distributors').insert(batch);
      setBatchProgress(75 + Math.round(((i+5)/TOTAL_DIST) * 25)); // 75→100%
      await new Promise(r => setTimeout(r, 50));
    }
    log(`✅ ${TOTAL_DIST} distributeurs insérés`);

    log("🎉 Génération complète — allez voir Détections, Plaintes, Distributeurs SIM");
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
            CDR voix · Plaintes · Distributeurs · {rulesCount} règles actives · 50% fraud / 50% légit
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
          <Btn onClick={generateAll} disabled={batchMode} small
            style={{ background: batchMode?"#e5e7eb":"#7c3aed", color:C.white, border:"none", padding:"6px 14px" }}>
            {batchMode ? `⏳ ${batchProgress}%` : "⚡ Générer tout (CDR + Plaintes + Distrib.)"}
          </Btn>
          {running
            ? <Btn onClick={pause} variant="outline" small style={{ color:C.warning, borderColor:C.warning }}>⏸ Pause</Btn>
            : <Btn onClick={start} variant="navy" small>▶ Flux CDR continu</Btn>
          }
        </div>
      </div>

      {/* Barre de progression */}
      {batchMode && (
        <div style={{ marginBottom:12 }}>
          <div style={{ height:6, background:C.mutedL, borderRadius:4, marginBottom:8 }}>
            <div style={{ width:`${batchProgress}%`, height:"100%", background:"#7c3aed", borderRadius:4, transition:"width 0.2s" }} />
          </div>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
            {batchLog.map((l,i) => (
              <span key={i} style={{ fontSize:11, color: l.startsWith("✅")||l.startsWith("🎉") ? C.success : l.startsWith("❌") ? C.danger : C.navy }}>
                {l}
              </span>
            ))}
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
          <span>État MSISDN (24h)</span><span style={{ textAlign:"right" }}>Résultat</span>
        </div>
        <div style={{ maxHeight:520, overflowY:"auto" }}>
          {feed.length===0 ? (
            <div style={{ padding:"60px 24px", textAlign:"center", color:C.muted }}>
              <div style={{ fontSize:32, marginBottom:12 }}>📡</div>
              <div style={{ fontSize:14, fontWeight:600 }}>En attente du flux CDR</div>
              <div style={{ fontSize:12, marginTop:6 }}>
                <b>⚡ Générer tout</b> pour un batch complet (CDR + Plaintes + Distributeurs) · <b>▶ Flux</b> pour le temps réel
              </div>
            </div>
          ) : feed.map((entry,idx) => <CdrRow key={entry.id} entry={entry} idx={idx} />)}
        </div>
      </Card>

      <div style={{ marginTop:12, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontSize:11, color:C.muted, fontWeight:700 }}>Profils fraud :</span>
        {FRAUD_PROFILES.map(p => (
          <span key={p.id} style={{ fontSize:10, padding:"2px 8px", borderRadius:12,
            background:(FRAUD_COLOR[p.type]||C.warning)+"22", color:FRAUD_COLOR[p.type]||C.warning,
            border:`1px solid ${(FRAUD_COLOR[p.type]||C.warning)}44` }}>
            {p.id} · {p.label}
          </span>
        ))}
        <span style={{ fontSize:11, color:C.muted, fontWeight:700, marginLeft:8 }}>Légit :</span>
        {LEGIT_PROFILES.map(p => (
          <span key={p.id} style={{ fontSize:10, padding:"2px 8px", borderRadius:12,
            background:C.success+"22", color:C.success, border:`1px solid ${C.success}44` }}>
            {p.id} · {p.label}
          </span>
        ))}
      </div>

      <div style={{ marginTop:8, display:"flex", gap:16, fontSize:11, color:C.muted }}>
        <span>💡 Après génération → <b>Détections</b> (alertes CDR) · <b>Plaintes</b> (40 plaintes) · <b>Distributeurs SIM</b> (20 distrib. dont suspects)</span>
      </div>
    </div>
  );
}
