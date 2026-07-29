// ── SHIELD SimProfile 360° — design aligné AAR Mobile Money ─────────────────
import { useState, useEffect, useCallback } from "react";
import { C, sevColor, statusColor, statusLabel } from "../theme.js";
import { Card, Badge, Btn } from "../components.jsx";
import { Icon } from "../icons.jsx";
import { supabase } from "../supabase.js";
import { blockAndBlacklist } from "../blockAndBlacklist.js";

const fmtDate = (s) => s ? new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—";
const fmtTime = (s) => s ? new Date(s).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";

// ── Composants partagés ────────────────────────────────────────────────────
function ScoreCircle({ value, color, size = 72 }) {
  const v = Math.round(value || 0);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const arc = circ * (1 - v / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.mutedL} strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={arc}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      <text x={size/2} y={size/2+6} textAnchor="middle"
        fontSize={size > 60 ? 18 : 13} fontWeight="900" fill={color} fontFamily="DM Sans, sans-serif">{v}</text>
    </svg>
  );
}

function RiskBar({ label, value, color }) {
  const v = Math.min(Math.round(value || 0), 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: C.textL }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{v}</span>
      </div>
      <div style={{ height: 4, background: C.mutedL, borderRadius: 4 }}>
        <div style={{ width: `${v}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

function KPI({ label, value, color, sub }) {
  return (
    <div style={{ background: C.bg, borderRadius: 8, padding: "10px 14px", borderLeft: `3px solid ${color || C.mutedL}` }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: color || C.navy }}>{value}</div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: C.textL, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// ── Action alerte ──────────────────────────────────────────────────────────
async function applyAlertAction(alertId, action, msisdn, operatorId, addLog) {
  const statusMap = { block: "blocked", investigate: "investigating", false_positive: "false_positive", clear: "cleared" };
  const newStatus = statusMap[action] || action;
  await supabase.from("alerts").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", alertId);
  if (action === "block" && msisdn && operatorId) {
    const { data: ex } = await supabase.from("blockings").select("id").eq("msisdn", msisdn).eq("active", true).maybeSingle();
    if (!ex) await supabase.from("blockings").insert([{ operator_id: operatorId, msisdn, reason: "Blocage SimProfile", source: "analyst", active: true, blocked_at: new Date().toISOString() }]);
  }
  addLog?.("UPDATE_ALERT_STATUS", "alert", alertId, `SimProfile → ${newStatus} — ${msisdn}`, "SimProfile");
  return newStatus;
}

// ── Calcul scores fraude depuis données CDR + vue ─────────────────────────
function computeScores(view, cellMoves, swapCount) {
  const n       = view.call_out_count || 0;
  const shorts  = view.short_calls    || 0;
  const intl    = view.intl_calls     || 0;
  const premium = view.premium_calls  || 0;
  const cells   = view.unique_cells   || cellMoves.length || 1;
  const dur     = view.avg_duration_sec || 0;
  const swaps   = swapCount || view.sim_swap_count || 0;

  // SIM Box : 1 seule antenne + volume élevé + durée courte-moyenne
  const simbox = Math.min(100, Math.round(
    (cells === 1 ? 50 : cells <= 2 ? 20 : 0) +
    Math.min(30, (n / 150) * 30) +
    (dur >= 10 && dur <= 60 ? 20 : dur < 10 && dur > 0 ? 10 : 0)
  ));

  // Wangiri : beaucoup de courts + premium
  const wangiri = n > 0 ? Math.min(100, Math.round(
    (shorts / n) * 60 +
    (premium / Math.max(n, 1)) * 40
  )) : 0;

  // IRSF : international + premium + longue durée
  const irsf = n > 0 ? Math.min(100, Math.round(
    (intl / n) * 35 +
    (premium / Math.max(n, 1)) * 35 +
    (dur > 180 ? 30 : dur > 60 ? 15 : 0)
  )) : 0;

  // ATO : SIM swap + comportement changé
  const ato = Math.min(100, Math.round(
    swaps > 0 ? 50 + Math.min(40, swaps * 20) : 0
  ));

  return { score_simbox: simbox, score_wangiri: wangiri, score_irsf: irsf, score_ato: ato };
}

// ── Hook données SIM ───────────────────────────────────────────────────────
function useSimProfile(msisdn) {
  const [profile, setProfile]         = useState(null);
  const [cdrHistory, setCdrHistory]   = useState([]);
  const [simSwaps, setSimSwaps]       = useState([]);
  const [relatedAlerts, setRelAlerts] = useState([]);
  const [cellMovements, setCells]     = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  const fetch = useCallback(async (target) => {
    if (!target) return;
    setLoading(true); setError(null);
    try {
      const [simRes, cdrRes, swapRes, alertRes, cellRes] = await Promise.all([
        supabase.from("v_sim_profile").select("*").eq("msisdn", target).maybeSingle(),
        supabase.from("cdr_voice")
          .select("msisdn_a,msisdn_b,imsi,imei,cell_id,duration_sec,start_time,call_type,is_international,is_premium,country_code_b")
          .eq("msisdn_a", target).order("start_time", { ascending: false }).limit(50),
        supabase.from("sim_swap_history")
          .select("msisdn,old_imsi,new_imsi,old_imei,new_imei,swap_reason,swap_channel,swapped_at")
          .eq("msisdn", target).order("swapped_at", { ascending: false }),
        // ← Colonnes réelles : date et created_at (pas detected_at)
        supabase.from("alerts")
          .select("id,fraud_type,type,status,score,severity,date,created_at,operator_id,reason")
          .eq("msisdn", target).order("created_at", { ascending: false }).limit(10),
        supabase.from("cdr_voice").select("cell_id").eq("msisdn_a", target).limit(500),
      ]);

      const cdrVoice = cdrRes.data  || [];
      const swaps    = swapRes.data || [];
      const alerts   = alertRes.data || [];
      const cellsRaw = cellRes.data || [];

      // Antennes
      const cellCount = {};
      cellsRaw.forEach(r => { if (r.cell_id) cellCount[r.cell_id] = (cellCount[r.cell_id]||0)+1; });
      const cellMoves = Object.entries(cellCount).map(([cellId, count]) => ({ cellId, count })).sort((a,b) => b.count - a.count);

      const maxAlertScore = alerts.reduce((m, a) => Math.max(m, a.score||0), 0);

      let enriched;
      if (simRes.data) {
        // Vue existe — normaliser les noms de colonnes + calculer scores
        const v = simRes.data;
        const scores = computeScores(v, cellMoves, swaps.length);
        enriched = {
          msisdn:           v.msisdn,
          imei:             v.imei || cdrVoice[0]?.imei || null,
          imsi:             v.imsi || cdrVoice[0]?.imsi || null,
          cell_id:          cellMoves[0]?.cellId || null,
          call_out_count:   v.call_out_count || 0,
          call_in_count:    0,
          avg_duration_out: v.avg_duration_sec || 0,   // ← bonne colonne vue
          sms_out_count:    v.sms_count || 0,
          velocity_calls_per_min: 0,
          call_intl_out_count: v.intl_calls || 0,
          distinct_cell_ids: v.unique_cells || cellMoves.length,
          cell_id_fixed:    (v.unique_cells || cellMoves.length) === 1,
          ...scores,  // score_simbox, score_wangiri, score_irsf, score_ato calculés
          _maxAlertScore: maxAlertScore,
        };
      } else if (cdrVoice.length > 0 || alerts.length > 0) {
        // Pas de vue — tout calculer depuis CDR bruts
        const shorts  = cdrVoice.filter(r => (r.duration_sec||0) < 3).length;
        const intlN   = cdrVoice.filter(r => r.is_international).length;
        const premN   = cdrVoice.filter(r => r.is_premium).length;
        const avgDur  = cdrVoice.reduce((s,r) => s+(r.duration_sec||0), 0) / (cdrVoice.length||1);
        const fakeView = {
          call_out_count: cdrVoice.length, short_calls: shorts,
          intl_calls: intlN, premium_calls: premN,
          avg_duration_sec: avgDur, unique_cells: cellMoves.length,
          sim_swap_count: swaps.length,
        };
        const scores = computeScores(fakeView, cellMoves, swaps.length);
        enriched = {
          msisdn: target, imei: cdrVoice[0]?.imei||null, imsi: cdrVoice[0]?.imsi||null,
          cell_id: cellMoves[0]?.cellId||null,
          call_out_count: cdrVoice.length, call_in_count: 0,
          avg_duration_out: avgDur, sms_out_count: 0, velocity_calls_per_min: 0,
          call_intl_out_count: intlN,
          distinct_cell_ids: cellMoves.length, cell_id_fixed: cellMoves.length === 1,
          ...scores, _maxAlertScore: maxAlertScore,
        };
      } else { enriched = null; }

      setProfile(enriched); setCdrHistory(cdrVoice); setSimSwaps(swaps); setRelAlerts(alerts); setCells(cellMoves);
    } catch(err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (msisdn) fetch(msisdn); }, [msisdn, fetch]);
  return { profile, cdrHistory, simSwaps, relatedAlerts, cellMovements, loading, error, fetchProfile: fetch };
}

const TABS = ["Résumé", "CDR Voix", "Alertes", "SIM & Antennes"];

// ── Composant principal ────────────────────────────────────────────────────
export default function SimProfile({ msisdn: initMsisdn, score: initScore, fraudType, onBack,
  setBlacklist, setBlockings, blacklist, alerts: propAlerts, users, addLog, currentUser,
  addEntry, createBlocking, operators }) {

  const [inputMsisdn, setInputMsisdn]     = useState(initMsisdn || "");
  const [searchMsisdn, setSearchMsisdn]   = useState(initMsisdn || "");
  const [tab, setTab]                     = useState("Résumé");
  const [actionLoading, setActionLoading] = useState(null);
  const [actionDone, setActionDone]       = useState(null);
  const [localStatuses, setLocalStatuses] = useState({});

  const { profile, cdrHistory, simSwaps, relatedAlerts, cellMovements,
          loading, error, fetchProfile } = useSimProfile(searchMsisdn);

  const handleSearch = (e) => {
    e?.preventDefault();
    const m = inputMsisdn.trim();
    if (m) { setSearchMsisdn(m); fetchProfile(m); }
  };

  const suspectMsisdns = [...new Set((propAlerts||[]).filter(a=>a.msisdn).map(a=>a.msisdn))].slice(0,5);

  // Alertes depuis propAlerts en fallback si la query DB ne retourne rien
  const propAlertsForMsisdn = (propAlerts||[]).filter(a =>
    a.msisdn === searchMsisdn || a.msisdn_a === searchMsisdn || a.subject === searchMsisdn
  );
  const effectiveAlerts = relatedAlerts.length > 0 ? relatedAlerts : propAlertsForMsisdn;

  // Score global = max(scores DB, max alertes, initScore passé en prop)
  const dbMaxScore = profile
    ? Math.max(profile.score_simbox||0, profile.score_wangiri||0, profile.score_ato||0, profile.score_irsf||0)
    : 0;
  const alertMaxScore = effectiveAlerts.reduce((m, a) => Math.max(m, a.score||0), 0);
  const globalRisk = Math.max(dbMaxScore, alertMaxScore, (profile?._maxAlertScore||0), (!profile ? (initScore||0) : 0));
  const riskColor = globalRisk>=80?C.danger:globalRisk>=50?C.warning:globalRisk>=30?C.sky:C.success;
  const riskLabel = globalRisk>=80?"Critique":globalRisk>=50?"Élevé":globalRisk>=30?"Moyen":"Faible";

  async function handleAlertAction(alertId, action, operatorId) {
    setActionLoading(alertId+action);
    try {
      const newStatus = await applyAlertAction(alertId, action, searchMsisdn, operatorId, addLog);
      if (action==="block") {
        await blockAndBlacklist({ msisdn: searchMsisdn, imei: profile?.imei, imsi: profile?.imsi,
          cell_id: profile?.cell_id, operatorId: effectiveAlerts[0]?.operator_id||null,
          reason: `SimProfile — ${fraudType||"Fraude"} — Score ${initScore}`, addLog });
        const allBlocked = {};
        effectiveAlerts.forEach(a => { allBlocked[a.id] = "blocked"; });
        setLocalStatuses(allBlocked);
      } else {
        setLocalStatuses(p => ({...p,[alertId]:newStatus}));
      }
      setActionDone(newStatus);
      setTimeout(()=>setActionDone(null), 3000);
    } catch(err) { console.error(err); }
    finally { setActionLoading(null); }
  }

  async function addToList(list, entity, value) {
    if (!window.confirm(`Ajouter ${value} en ${list} ?`)) return;
    const opId = effectiveAlerts[0]?.operator_id || null;
    await supabase.from("control_lists").insert([{ list_type: list, entry_type: entity, value, reason: "SimProfile", active: true }]);
    addEntry?.({ list, type: entity, value, reason: "SimProfile" }, opId);
    addLog?.(`${list.toUpperCase()}_${entity.toUpperCase()}`, "control_list", value, `Ajout ${entity} → ${list}`, "SimProfile");
    alert(`✓ ${value} ajouté en ${list}`);
  }

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", height: "100%", display: "flex", flexDirection: "column" }}>

      {/* ── En-tête fixe navy ─────────────────────────────────────────────── */}
      <div style={{ background: C.navy, padding: "14px 24px 0", flexShrink: 0 }}>

        {/* Ligne 1 : retour + recherche + suspects */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          {onBack && (
            <button onClick={onBack} style={{ background:"none",border:"none",color:C.muted,cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontSize:12,padding:0,flexShrink:0 }}>
              <Icon name="logout" size={13} color={C.muted} /> Retour
            </button>
          )}
          <form onSubmit={handleSearch} style={{ display:"flex",gap:8,flex:1 }}>
            <input value={inputMsisdn} onChange={e=>setInputMsisdn(e.target.value)}
              placeholder="MSISDN (ex: 226695924544)"
              style={{ flex:1,maxWidth:280,border:"1px solid #2A3F6A",borderRadius:7,padding:"7px 12px",fontSize:13,color:C.white,background:"#0a1530",outline:"none",fontFamily:"monospace" }} />
            <button type="submit" disabled={loading}
              style={{ background:C.orange,border:"none",color:C.white,borderRadius:7,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer" }}>
              {loading?"…":"Analyser"}
            </button>
          </form>
          {suspectMsisdns.length>0 && (
            <div style={{ display:"flex",gap:5,flexWrap:"wrap" }}>
              {suspectMsisdns.slice(0,3).map(m=>(
                <button key={m} onClick={()=>{setInputMsisdn(m);setSearchMsisdn(m);fetchProfile(m);}}
                  style={{ padding:"3px 8px",background:C.danger+"22",color:C.danger,border:`1px solid ${C.danger}44`,borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"monospace" }}>{m}</button>
              ))}
            </div>
          )}
        </div>

        {/* Ligne 2 : identité + score (si profil chargé) */}
        {profile && (
          <div style={{ display:"flex",alignItems:"center",gap:20,paddingBottom:14,borderBottom:"1px solid #1e3060" }}>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" }}>
                <span style={{ fontSize:20,fontWeight:900,color:C.white,letterSpacing:1,fontFamily:"monospace" }}>{profile.msisdn}</span>
                <span style={{ background:riskColor,color:C.white,fontSize:9,fontWeight:800,padding:"2px 8px",borderRadius:10,letterSpacing:1 }}>{riskLabel.toUpperCase()}</span>
                {fraudType && <span style={{ background:C.danger+"33",color:C.danger,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:8,border:`1px solid ${C.danger}55` }}>{fraudType}</span>}
                {profile.cell_id_fixed && <span style={{ background:C.warning+"33",color:C.warning,fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:8 }}>ANTENNE FIXE</span>}
              </div>
              <div style={{ display:"flex",gap:10,marginTop:6,flexWrap:"wrap" }}>
                {profile.imei && <span style={{ fontSize:11,color:C.muted }}>IMEI : <span style={{ color:C.sky,fontFamily:"monospace" }}>{profile.imei?.slice(0,8)}…</span></span>}
                {profile.imsi && <><span style={{ color:"#1e3060" }}>|</span><span style={{ fontSize:11,color:C.muted }}>IMSI : <span style={{ color:C.purple,fontFamily:"monospace" }}>{profile.imsi?.slice(0,6)}…</span></span></>}
                {profile.cell_id && <><span style={{ color:"#1e3060" }}>|</span><span style={{ fontSize:11,color:C.muted }}>Cell : <span style={{ color:C.warning }}>{profile.cell_id}</span></span></>}
                <span style={{ color:"#1e3060" }}>|</span>
                <span style={{ fontSize:11,color:C.muted }}>{profile.distinct_cell_ids||cellMovements.length} antenne(s)</span>
              </div>
            </div>
          </div>
        )}

        {/* Ligne 3 : actions rapides + onglets */}
        {profile && (
          <div style={{ display:"flex",alignItems:"center",gap:0 }}>
            {/* Quick actions */}
            <div style={{ display:"flex",gap:6,padding:"10px 0",marginRight:24 }}>
              <button onClick={async()=>{
                if(!window.confirm(`Bloquer ${searchMsisdn} ?`)) return;
                if(effectiveAlerts[0]) await handleAlertAction(effectiveAlerts[0].id,"block",effectiveAlerts[0].operator_id);
                else { await blockAndBlacklist({msisdn:searchMsisdn,imei:profile?.imei,imsi:profile?.imsi,operatorId:null,reason:"Blocage manuel SimProfile",addLog}); setActionDone("blocked"); }
              }} style={{ display:"flex",alignItems:"center",gap:5,background:C.danger,border:"none",color:C.white,borderRadius:6,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer" }}>
                <Icon name="blockings" size={12} color={C.white} /> Bloquer
              </button>
              <button onClick={()=>addToList("blacklist","msisdn",searchMsisdn)}
                style={{ display:"flex",alignItems:"center",gap:5,background:"none",border:`1px solid ${C.warning}`,color:C.warning,borderRadius:6,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer" }}>
                <Icon name="list-check" size={12} color={C.warning} /> Blacklist
              </button>
              <button onClick={()=>addToList("watchlist","msisdn",searchMsisdn)}
                style={{ display:"flex",alignItems:"center",gap:5,background:"none",border:`1px solid ${C.sky}`,color:C.sky,borderRadius:6,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer" }}>
                <Icon name="alerts" size={12} color={C.sky} /> Watchlist
              </button>
              <button onClick={()=>addToList("whitelist","msisdn",searchMsisdn)}
                style={{ display:"flex",alignItems:"center",gap:5,background:"none",border:`1px solid ${C.success}`,color:C.success,borderRadius:6,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer" }}>
                <Icon name="check" size={12} color={C.success} /> Whitelist
              </button>
            </div>
            {/* Tabs */}
            <div style={{ display:"flex",gap:0 }}>
              {TABS.map(t=>(
                <button key={t} onClick={()=>setTab(t)}
                  style={{ background:"none",border:"none",borderBottom:tab===t?`2px solid ${C.orange}`:"2px solid transparent",color:tab===t?C.white:C.muted,padding:"10px 16px",fontSize:12,fontWeight:tab===t?700:400,cursor:"pointer",letterSpacing:0.3 }}>
                  {t}
                  {t==="Alertes"&&effectiveAlerts.length>0&&<span style={{ marginLeft:5,background:C.danger,color:C.white,fontSize:9,fontWeight:800,padding:"1px 5px",borderRadius:8 }}>{effectiveAlerts.length}</span>}
                  {t==="SIM & Antennes"&&simSwaps.length>0&&<span style={{ marginLeft:5,background:C.warning,color:C.white,fontSize:9,fontWeight:800,padding:"1px 5px",borderRadius:8 }}>{simSwaps.length}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Corps scrollable ─────────────────────────────────────────────── */}
      <div style={{ flex:1,overflowY:"auto",padding:"20px 24px",background:C.bg }}>

        {/* Notification action */}
        {actionDone && (
          <div style={{ background:C.successL,border:`1px solid ${C.success}44`,borderRadius:10,padding:"12px 16px",marginBottom:14,color:C.success,fontWeight:700,display:"flex",alignItems:"center",gap:8 }}>
            <Icon name="check" size={14} color={C.success} /> {statusLabel(actionDone)} — {searchMsisdn}
          </div>
        )}

        {/* État vide */}
        {!searchMsisdn&&!loading&&(
          <div style={{ textAlign:"center",padding:"80px 20px",color:C.muted }}>
            <Icon name="alerts" size={36} color={C.mutedL} />
            <div style={{ marginTop:16,fontSize:14 }}>Entrez un MSISDN pour analyser son profil SIM 360°</div>
          </div>
        )}

        {/* Chargement */}
        {loading&&(
          <div style={{ textAlign:"center",padding:"80px 20px",color:C.muted }}>
            <Icon name="zap" size={28} color={C.mutedL} />
            <div style={{ marginTop:14,fontSize:13 }}>Analyse en cours pour <strong style={{ color:C.navy }}>{searchMsisdn}</strong>…</div>
          </div>
        )}

        {/* Aucun CDR */}
        {!loading&&searchMsisdn&&!profile&&(
          <div style={{ textAlign:"center",padding:"80px 20px",color:C.muted }}>
            <Icon name="list-check" size={28} color={C.mutedL} />
            <div style={{ marginTop:14,fontSize:13 }}>Aucun CDR trouvé pour <strong style={{ color:C.navy }}>{searchMsisdn}</strong></div>
            <div style={{ fontSize:11,marginTop:6 }}>Ce MSISDN n'apparaît pas dans les tables CDR.</div>
          </div>
        )}

        {/* ── TAB : Résumé ─────────────────────────────────────────────── */}
        {!loading&&profile&&tab==="Résumé"&&(
          <>
            {/* KPIs */}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8,marginBottom:16 }}>
              <KPI label="Appels sortants"   value={profile.call_out_count??0}    color={C.orange} />
              <KPI label="Appels entrants"   value={profile.call_in_count??0}      color={C.success} />
              <KPI label="Durée moy. (s)"   value={Math.round(profile.avg_duration_out||0)} color={profile.avg_duration_out<3?C.danger:C.sky} sub={profile.avg_duration_out<3?"⚠️ Wangiri possible":undefined} />
              <KPI label="SMS sortants"      value={profile.sms_out_count??0}      color={C.purple} />
              <KPI label="Vélocité/min"      value={(profile.velocity_calls_per_min||0).toFixed(2)} color={profile.velocity_calls_per_min>10?C.danger:C.navy} />
              <KPI label="Appels intl."      value={profile.call_intl_out_count??0} color={profile.call_intl_out_count>50?C.warning:C.navy} />
              <KPI label="Antennes distinctes" value={cellMovements.length}        color={cellMovements.length===1?C.danger:C.teal} sub={cellMovements.length===1?"⚠️ SIM Box possible":undefined} />
              <KPI label="SIM Swaps"         value={simSwaps.length}               color={simSwaps.length>0?C.danger:C.success} />
              <KPI label="Alertes liées"     value={effectiveAlerts.length}           color={effectiveAlerts.length>0?C.danger:C.success} />
            </div>

            {/* Indicateurs de risque */}
            <Card style={{ padding:"16px 20px",marginBottom:14 }}>
              <div style={{ fontSize:13,fontWeight:700,color:C.navy,marginBottom:14,display:"flex",alignItems:"center",gap:8 }}>
                <Icon name="scoring" size={14} color={C.navy} /> Indicateurs de risque
              </div>
              <div style={{ columns:2,columnGap:32 }}>
                <RiskBar label="SIM Box" value={profile.score_simbox} color={(profile.score_simbox||0)>=70?C.danger:(profile.score_simbox||0)>=40?C.warning:C.success} />
                <RiskBar label="Wangiri" value={profile.score_wangiri} color={(profile.score_wangiri||0)>=70?C.danger:(profile.score_wangiri||0)>=40?C.warning:C.success} />
                <RiskBar label="ATO"     value={profile.score_ato}     color={(profile.score_ato||0)>=70?C.danger:(profile.score_ato||0)>=40?C.warning:C.success} />
                <RiskBar label="IRSF"    value={profile.score_irsf}    color={(profile.score_irsf||0)>=70?C.warning:(profile.score_irsf||0)>=40?C.sky:C.success} />
              </div>
            </Card>

            {/* Analyse rapide flags */}
            {(()=>{
              const flags=[];
              if((profile.score_simbox||0)>=70) flags.push({color:C.danger,text:`SIM Box probable — ${Math.round(profile.score_simbox)}/100`,detail:"Antenne fixe, zéro data, appels massifs"});
              if((profile.score_wangiri||0)>=70) flags.push({color:C.danger,text:`Wangiri probable — ${Math.round(profile.score_wangiri)}/100`,detail:"Appels courts séquentiels vers numéros premium"});
              if((profile.score_ato||0)>=70) flags.push({color:C.danger,text:`ATO probable — ${Math.round(profile.score_ato)}/100`,detail:"Account Takeover — activité suspecte"});
              if((profile.score_irsf||0)>=70) flags.push({color:C.warning,text:`IRSF probable — ${Math.round(profile.score_irsf)}/100`,detail:"Trafic intl massif vers numéros surtaxés"});
              if(profile.cell_id_fixed) flags.push({color:C.warning,text:"Antenne fixe détectée",detail:`SIM toujours sur ${profile.cell_id} — indicateur SIM Box`});
              if(simSwaps.length>0) flags.push({color:C.danger,text:`${simSwaps.length} SIM Swap(s) détecté(s)`,detail:"Risque ATO élevé après changement de SIM"});
              if(effectiveAlerts.length>0) flags.push({color:C.danger,text:`${effectiveAlerts.length} alerte(s) générée(s)`,detail:[...new Set(effectiveAlerts.map(a=>a.fraud_type||a.fraudType))].filter(Boolean).join(", ")});
              if(flags.length===0) flags.push({color:C.success,text:"Aucun indicateur de fraude",detail:"Comportement normal"});
              return(
                <Card style={{ padding:"14px 18px",borderLeft:`4px solid ${flags[0].color}` }}>
                  <div style={{ fontSize:12,fontWeight:700,color:C.navy,marginBottom:10,display:"flex",alignItems:"center",gap:7 }}>
                    <Icon name="zap" size={13} color={C.navy} /> Analyse rapide
                  </div>
                  {flags.map((f,i)=>(
                    <div key={i} style={{ display:"flex",alignItems:"flex-start",gap:8,background:f.color+"0A",borderRadius:7,padding:"7px 10px",marginBottom:4 }}>
                      <div style={{ width:8,height:8,borderRadius:"50%",background:f.color,flexShrink:0,marginTop:3 }} />
                      <div>
                        <div style={{ fontSize:12,fontWeight:700,color:f.color }}>{f.text}</div>
                        <div style={{ fontSize:11,color:C.textL,marginTop:1 }}>{f.detail}</div>
                      </div>
                    </div>
                  ))}
                </Card>
              );
            })()}
          </>
        )}

        {/* ── TAB : CDR Voix ─────────────────────────────────────────────── */}
        {!loading&&profile&&tab==="CDR Voix"&&(
          <Card style={{ padding:0,overflow:"hidden" }}>
            {cdrHistory.length===0?(
              <div style={{ padding:"40px",textAlign:"center",color:C.muted,fontSize:13 }}>Aucun CDR voix disponible.</div>
            ):(
              <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
                <thead>
                  <tr style={{ background:C.bg,borderBottom:`2px solid ${C.mutedL}` }}>
                    {["Date","Heure","Numéro B","Durée (s)","Cell ID","Type","Flag"].map(h=>(
                      <th key={h} style={{ padding:"10px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cdrHistory.map((c,i)=>(
                    <tr key={i} style={{ borderBottom:`1px solid ${C.mutedL}`,background:i%2===0?C.white:C.bg }}>
                      <td style={{ padding:"9px 14px",color:C.textL,fontFamily:"monospace" }}>{fmtDate(c.start_time)}</td>
                      <td style={{ padding:"9px 14px",color:C.muted,fontSize:11 }}>{fmtTime(c.start_time)}</td>
                      <td style={{ padding:"9px 14px",fontFamily:"monospace",color:C.navy }}>{c.msisdn_b||"—"}</td>
                      <td style={{ padding:"9px 14px",color:c.duration_sec<3?C.danger:C.textL,fontWeight:c.duration_sec<3?700:400 }}>{c.duration_sec??0}</td>
                      <td style={{ padding:"9px 14px",color:C.muted,fontSize:11 }}>{c.cell_id||"—"}</td>
                      <td style={{ padding:"9px 14px" }}>
                        <span style={{ background:c.is_international?C.warningL:C.bg,color:c.is_international?C.warning:C.muted,fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:5 }}>
                          {c.is_international?"🌍 Intl":c.call_type||"Local"}
                        </span>
                      </td>
                      <td style={{ padding:"9px 14px" }}>
                        {c.is_premium?<span style={{ background:C.dangerL,color:C.danger,fontSize:9,fontWeight:800,padding:"2px 6px",borderRadius:5 }}>PREMIUM</span>:<span style={{ color:C.success,fontSize:12 }}>✓</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}

        {/* ── TAB : Alertes ─────────────────────────────────────────────── */}
        {!loading&&profile&&tab==="Alertes"&&(
          <Card style={{ padding:"16px 20px" }}>
            <div style={{ fontSize:13,fontWeight:700,color:C.navy,marginBottom:12 }}>
              Alertes liées — {searchMsisdn} ({effectiveAlerts.length})
            </div>
            {effectiveAlerts.length===0?(
              <div style={{ fontSize:12,color:C.muted,padding:"20px 0" }}>Aucune alerte directement liée à ce MSISDN.</div>
            ):effectiveAlerts.map((a,i)=>{
              const curStatus=localStatuses[a.id]||a.status;
              const isActive=!["blocked","false_positive","cleared"].includes(curStatus);
              return(
                <div key={i} style={{ display:"flex",flexDirection:"column",gap:8,padding:"12px 0",borderBottom:`1px solid ${C.mutedL}`,background:isActive?C.white:C.bg }}>
                  <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                    <div style={{ width:4,height:36,borderRadius:2,background:sevColor(a.severity||"medium"),flexShrink:0 }} />
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:12,fontWeight:700,color:C.navy }}>{a.fraud_type||a.fraudType||a.type||"Alerte fraude"}</div>
                      <div style={{ fontSize:11,color:C.muted,marginTop:1 }}>{(a.created_at||a.detected_at||a.detectedAt||a.date)?new Date(a.created_at||a.detected_at||a.detectedAt||a.date).toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"short"}):"—"}</div>
                    </div>
                    <div style={{ fontSize:16,fontWeight:900,color:(a.score||0)>=80?C.danger:C.warning,minWidth:36,textAlign:"right" }}>{a.score}</div>
                    <span style={{ background:statusColor(curStatus)+"22",color:statusColor(curStatus),fontSize:9,fontWeight:800,padding:"3px 8px",borderRadius:8,letterSpacing:0.5 }}>
                      {statusLabel(curStatus)}
                    </span>
                  </div>
                  {isActive&&(
                    <div style={{ display:"flex",gap:6,flexWrap:"wrap",paddingLeft:16 }}>
                      <Btn variant="danger" small disabled={!!actionLoading} onClick={()=>handleAlertAction(a.id,"block",a.operator_id)}>{actionLoading===a.id+"block"?"…":"🚫 Bloquer"}</Btn>
                      <Btn variant="warning" small disabled={!!actionLoading} onClick={()=>handleAlertAction(a.id,"investigate",a.operator_id)}>{actionLoading===a.id+"investigate"?"…":"🔍 En cours"}</Btn>
                      <Btn variant="sky" small disabled={!!actionLoading} onClick={()=>handleAlertAction(a.id,"false_positive",a.operator_id)}>{actionLoading===a.id+"false_positive"?"…":"✓ Faux positif"}</Btn>
                      <Btn variant="success" small disabled={!!actionLoading} onClick={()=>handleAlertAction(a.id,"clear",a.operator_id)}>{actionLoading===a.id+"clear"?"…":"✓ Clôturer"}</Btn>
                    </div>
                  )}
                </div>
              );
            })}
            {effectiveAlerts.length>0&&(
              <div style={{ marginTop:16 }}>
                <Btn variant="danger" style={{ width:"100%",justifyContent:"center" }}
                  onClick={async()=>{
                    if(!window.confirm(`Bloquer définitivement ${searchMsisdn} et toutes ses alertes ?`)) return;
                    for(const a of effectiveAlerts){
                      const s=localStatuses[a.id]||a.status;
                      if(!["blocked","false_positive","cleared"].includes(s)) await handleAlertAction(a.id,"block",a.operator_id);
                    }
                  }}>🚫 Bloquer {searchMsisdn} — toutes les alertes</Btn>
              </div>
            )}
          </Card>
        )}

        {/* ── TAB : SIM & Antennes ──────────────────────────────────────── */}
        {!loading&&profile&&tab==="SIM & Antennes"&&(
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            {/* SIM swaps */}
            <Card style={{ padding:"16px 20px" }}>
              <div style={{ fontSize:13,fontWeight:700,color:C.navy,marginBottom:12 }}>SIM Swaps ({simSwaps.length})</div>
              {simSwaps.length===0?(
                <div style={{ color:C.success,fontSize:12,display:"flex",alignItems:"center",gap:6 }}><Icon name="check" size={14} color={C.success} /> Aucun SIM Swap détecté</div>
              ):simSwaps.map((s,i)=>(
                <div key={i} style={{ padding:"10px 0",borderBottom:`1px solid ${C.mutedL}` }}>
                  <div style={{ fontSize:12,color:C.navy,fontFamily:"monospace" }}>
                    {s.old_imsi||s.old_imei||"—"} → {s.new_imsi||s.new_imei||"—"}
                  </div>
                  <div style={{ fontSize:10,color:C.muted,marginTop:3 }}>
                    {s.swap_reason||"—"} · {s.swapped_at?new Date(s.swapped_at).toLocaleString("fr-FR"):"—"}
                  </div>
                </div>
              ))}
            </Card>

            {/* Antennes */}
            <Card style={{ padding:"16px 20px" }}>
              <div style={{ fontSize:13,fontWeight:700,color:C.navy,marginBottom:12 }}>Antennes BTS fréquentées ({cellMovements.length})</div>
              {cellMovements.length===0?(
                <div style={{ color:C.muted,fontSize:12 }}>Aucune donnée antenne dans les CDR</div>
              ):cellMovements.slice(0,8).map((c,i)=>(
                <div key={i} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.mutedL}` }}>
                  <span style={{ fontSize:12,fontWeight:600,color:C.navy,fontFamily:"monospace" }}>{c.cellId}</span>
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <div style={{ height:6,width:Math.max(20,Math.round((c.count/(cellMovements[0]?.count||1))*100)),background:i===0?C.orange:C.sky,borderRadius:3 }} />
                    <span style={{ fontSize:11,color:C.muted,minWidth:32 }}>{c.count}x</span>
                  </div>
                </div>
              ))}
              {cellMovements.length===1&&(
                <div style={{ marginTop:10,fontSize:11,color:C.danger,fontWeight:600,background:C.dangerL,borderRadius:6,padding:"7px 12px" }}>
                  ⚠️ SIM fixe sur une seule antenne — fort indicateur SIM Box
                </div>
              )}
            </Card>

            {/* Actions sur les entités */}
            <Card style={{ padding:"16px 20px" }}>
              <div style={{ fontSize:13,fontWeight:700,color:C.navy,marginBottom:12,display:"flex",alignItems:"center",gap:8 }}>
                <Icon name="list-check" size={14} color={C.navy} /> Ajouter aux listes de contrôle
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12 }}>
                {[
                  {title:`MSISDN — ${profile.msisdn}`,entity:"msisdn",value:profile.msisdn,show:true},
                  {title:`IMEI — ${profile.imei?.slice(0,8)}…`,entity:"imei",value:profile.imei,show:!!profile.imei},
                  {title:`Cell ID — ${profile.cell_id}`,entity:"cell_id",value:profile.cell_id,show:!!profile.cell_id},
                ].filter(e=>e.show).map(ent=>(
                  <div key={ent.entity} style={{ background:C.bg,borderRadius:8,padding:"12px 14px" }}>
                    <div style={{ fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginBottom:10 }}>{ent.title}</div>
                    <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                      {[
                        {label:"🚫 Blacklister",list:"blacklist",color:C.danger},
                        {label:"✅ Whitelister",list:"whitelist",color:C.success,onlyMsisdn:true},
                        {label:"👁️ Watchlist",list:"watchlist",color:C.warning},
                      ].filter(opt=>!opt.onlyMsisdn||ent.entity==="msisdn").map(opt=>(
                        <button key={opt.list} onClick={()=>addToList(opt.list,ent.entity,ent.value)}
                          style={{ padding:"7px 10px",background:opt.color+"15",border:`1px solid ${opt.color}44`,color:opt.color,borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",textAlign:"left" }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
