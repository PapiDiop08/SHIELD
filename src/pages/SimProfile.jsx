// ── SHIELD SimProfile — design aligné AAR Mobile Money ───────────────────
import { useState, useEffect, useCallback } from "react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { C, sevColor, statusColor, statusLabel } from "../theme.js";
import { Card, Badge, Btn } from "../components.jsx";
import { supabase } from "../supabase.js";
import { blockAndBlacklist } from "../blockAndBlacklist.js";

// ── Action sur alerte ─────────────────────────────────────────────────────
async function applyAlertAction(alertId, action, msisdn, operatorId, addLog, setBlockings) {
  const statusMap = { block: 'blocked', investigate: 'investigating', false_positive: 'false_positive', clear: 'cleared', alert: 'alert' };
  const newStatus = statusMap[action] || action;
  await supabase.from('alerts').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', alertId);
  if (action === 'block' && msisdn && operatorId) {
    const { data: existing } = await supabase.from('blockings').select('id').eq('msisdn', msisdn).eq('active', true).maybeSingle();
    if (!existing) await supabase.from('blockings').insert([{ operator_id: operatorId, msisdn, reason: 'Blocage manuel depuis SimProfile', source: 'analyst', active: true, blocked_at: new Date().toISOString() }]);
  }
  addLog?.('UPDATE_ALERT_STATUS', 'alert', alertId, `SimProfile → ${newStatus} — ${msisdn}`, 'SimProfile');
  return newStatus;
}

// ── Hook profil complet ────────────────────────────────────────────────────
function useSimProfile(msisdn) {
  const [profile, setProfile]             = useState(null);
  const [cdrHistory, setCdrHistory]       = useState([]);
  const [simSwaps, setSimSwaps]           = useState([]);
  const [relatedAlerts, setRelatedAlerts] = useState([]);
  const [cellMovements, setCellMovements] = useState([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);

  const fetch = useCallback(async (target) => {
    if (!target) return;
    setLoading(true); setError(null);
    try {
      const [simRes, cdrRes, swapRes, alertRes, cellRes, smsRes] = await Promise.all([
        supabase.from("v_sim_profile").select("*").eq("msisdn", target).maybeSingle(),
        supabase.from("cdr_voice").select("msisdn_a,msisdn_b,imsi,imei,cell_id,duration_sec,start_time,call_type,is_international,is_premium,country_code_b").eq("msisdn_a", target).order("start_time", { ascending: false }).limit(10),
        supabase.from("sim_swap_history").select("msisdn,old_imsi,new_imsi,old_imei,new_imei,swap_reason,swap_channel,swapped_at").eq("msisdn", target).order("swapped_at", { ascending: false }),
        supabase.from("alerts").select("id,fraud_type,status,score,detected_at,triggered_rule_name,operator_id").eq("msisdn", target).order("detected_at", { ascending: false }).limit(10),
        supabase.from("cdr_voice").select("cell_id").eq("msisdn_a", target).limit(500),
        supabase.from("cdr_sms").select("msisdn_a,sms_type").eq("msisdn_a", target).limit(200),
      ]);
      const cdrVoice = cdrRes.data || [];
      const swaps    = swapRes.data || [];
      const alerts   = alertRes.data || [];
      const cellsRaw = cellRes.data || [];
      const smsRaw   = smsRes.data || [];
      const cellCount = {};
      cellsRaw.forEach(r => { if (r.cell_id) cellCount[r.cell_id] = (cellCount[r.cell_id] || 0) + 1; });
      const cellMoves = Object.entries(cellCount).map(([cellId, count]) => ({ cellId, count })).sort((a, b) => b.count - a.count);
      const enriched = simRes.data || (cdrVoice.length > 0 ? {
        msisdn: target, imei: cdrVoice[0]?.imei || null, imsi: cdrVoice[0]?.imsi || null,
        cell_id: cellMoves[0]?.cellId || null, call_out_count: cdrVoice.length, call_in_count: 0,
        avg_duration_out: cdrVoice.reduce((s, r) => s + (r.duration_sec || 0), 0) / (cdrVoice.length || 1),
        sms_out_count: smsRaw.length, velocity_calls_per_min: 0, distinct_cell_ids: cellMoves.length,
        cell_id_fixed: cellMoves.length === 1, score_simbox: 0, score_wangiri: 0, score_ato: 0, score_irsf: 0,
      } : null);
      setProfile(enriched); setCdrHistory(cdrVoice); setSimSwaps(swaps); setRelatedAlerts(alerts); setCellMovements(cellMoves);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (msisdn) fetch(msisdn); }, [msisdn, fetch]);
  return { profile, cdrHistory, simSwaps, relatedAlerts, cellMovements, loading, error, fetchProfile: fetch };
}

// ── Jauge score ───────────────────────────────────────────────────────────
function ScoreGauge({ label, score }) {
  const s = Math.round(score || 0);
  const color = s >= 80 ? C.danger : s >= 50 ? C.warning : s >= 30 ? C.sky : C.success;
  return (
    <div style={{ textAlign: "center", padding: "12px 0" }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", border: `4px solid ${color}`,
        display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", background: color + "10" }}>
        <span style={{ fontSize: 20, fontWeight: 900, color }}>{s}</span>
      </div>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────
function StatBox({ icon, value, label, color }) {
  return (
    <Card style={{ flex: "1 1 120px", padding: "14px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color || C.navy, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 4, fontWeight: 500 }}>{label}</div>
    </Card>
  );
}

// ── Composant principal ───────────────────────────────────────────────────
export default function SimProfile({ msisdn: initMsisdn, score: initScore, fraudType, onBack,
  setBlacklist, setBlockings, blacklist, alerts: propAlerts, users, addLog, currentUser,
  addEntry, createBlocking, operators }) {

  const [inputMsisdn, setInputMsisdn]     = useState(initMsisdn || "");
  const [searchMsisdn, setSearchMsisdn]   = useState(initMsisdn || "");
  const [actionLoading, setActionLoading] = useState(null);
  const [actionDone, setActionDone]       = useState(null);
  const [localAlertStatuses, setLocalAlertStatuses] = useState({});

  const { profile, cdrHistory, simSwaps, relatedAlerts, cellMovements,
          loading, error, fetchProfile } = useSimProfile(searchMsisdn);

  async function handleAlertAction(alertId, action, operatorId) {
    setActionLoading(alertId + action);
    try {
      const newStatus = await applyAlertAction(alertId, action, searchMsisdn, operatorId, addLog, setBlockings);
      if (action === 'block') {
        await blockAndBlacklist({ msisdn: searchMsisdn, imei: profile?.imei, imsi: profile?.imsi,
          cell_id: profile?.cell_id, operatorId: relatedAlerts[0]?.operator_id || null,
          reason: `Blocage SimProfile — ${fraudType || 'Fraude'} — Score ${initScore}`, addLog });
        const allBlocked = {};
        relatedAlerts.forEach(a => { allBlocked[a.id] = 'blocked'; });
        setLocalAlertStatuses(allBlocked);
      } else {
        setLocalAlertStatuses(p => ({ ...p, [alertId]: newStatus }));
      }
      setActionDone({ alertId, action, newStatus });
      setTimeout(() => setActionDone(null), 3000);
      if (['blocked', 'false_positive', 'cleared'].includes(newStatus) && onBack) setTimeout(() => onBack(), 1500);
    } catch (err) { console.error(err); }
    finally { setActionLoading(null); }
  }

  const QUICK = ["221776540001", "221776300001", "221775430001", "221778901001"];
  const handleSearch = (e) => { e.preventDefault(); if (inputMsisdn.trim()) { setSearchMsisdn(inputMsisdn.trim()); fetchProfile(inputMsisdn.trim()); } };

  const globalRisk = profile
    ? Math.max(profile.score_simbox || 0, profile.score_wangiri || 0, profile.score_ato || 0, profile.score_irsf || 0)
    : (initScore || 0);
  const riskColor = globalRisk >= 80 ? C.danger : globalRisk >= 50 ? C.warning : globalRisk >= 30 ? C.sky : C.success;
  const riskLabel = globalRisk >= 80 ? "Critique" : globalRisk >= 50 ? "Élevé" : globalRisk >= 30 ? "Moyen" : "Faible";
  const radarData = [
    { subject: "SIM Box", A: profile?.score_simbox || 0 },
    { subject: "Wangiri",  A: profile?.score_wangiri || 0 },
    { subject: "ATO",      A: profile?.score_ato || 0 },
    { subject: "IRSF",     A: profile?.score_irsf || 0 },
  ];

  return (
    <div style={{ padding: "28px 30px", fontFamily: "'DM Sans','Segoe UI',sans-serif", background: C.bg, minHeight: "100vh" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        {onBack && <Btn variant="ghost" onClick={onBack} small>← Retour</Btn>}
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: C.navy }}>📡 Profil SIM 360°</h1>
          <p style={{ margin: "3px 0 0", color: C.textL, fontSize: 12 }}>Analyse complète depuis les CDR — voix, SMS, antennes, SIM swaps</p>
        </div>
      </div>

      {/* ── Recherche ──────────────────────────────────────────────────── */}
      <form onSubmit={handleSearch} style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.muted }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/>
            </svg>
          </span>
          <input value={inputMsisdn} onChange={e => setInputMsisdn(e.target.value)}
            placeholder="Entrer un MSISDN (ex: 226695924544)"
            style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8,
              padding: "10px 12px 10px 34px", fontSize: 13, color: C.navy, outline: "none", boxSizing: "border-box", background: C.white }} />
        </div>
        <Btn type="submit">🔍 Analyser</Btn>
      </form>

      {/* Quick picks */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Suspects rapides :</span>
        {QUICK.map(m => (
          <button key={m} onClick={() => { setInputMsisdn(m); setSearchMsisdn(m); fetchProfile(m); }}
            style={{ padding: "3px 10px", background: C.dangerL, color: C.danger,
              border: `1px solid ${C.danger}33`, borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>
            {m}
          </button>
        ))}
      </div>

      {/* ── États vides / chargement ────────────────────────────────────── */}
      {!searchMsisdn && (
        <Card style={{ padding: "60px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>📱</div>
          <div style={{ fontSize: 14, color: C.textL, fontWeight: 600 }}>Entrez un MSISDN pour analyser son profil</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>CDR voix, SMS, antennes, SIM swaps, alertes</div>
        </Card>
      )}
      {loading && (
        <Card style={{ padding: "60px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
          <div style={{ color: C.textL, fontSize: 13 }}>Chargement en cours…</div>
        </Card>
      )}
      {error && (
        <div style={{ background: C.dangerL, border: `1px solid ${C.danger}44`, borderRadius: 10, padding: "12px 16px", color: C.danger, marginBottom: 16, fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}
      {!loading && searchMsisdn && !profile && !error && (
        <Card style={{ padding: "60px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>Aucun CDR trouvé pour <span style={{ fontFamily: "monospace" }}>{searchMsisdn}</span></div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Ce MSISDN n'apparaît pas dans les tables CDR</div>
        </Card>
      )}

      {profile && !loading && (
        <>
          {/* ── Identité + Score global ─────────────────────────────────── */}
          <Card style={{ padding: "20px 24px", marginBottom: 14, borderLeft: `4px solid ${riskColor}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 900, color: C.navy, letterSpacing: 1, fontFamily: "monospace" }}>
                  {profile.msisdn}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {profile.imei && <Badge label={`IMEI: ${profile.imei?.slice(0,8)}…`} color={C.sky} small />}
                  {profile.imsi && <Badge label={`IMSI: ${profile.imsi?.slice(0,6)}…`} color={C.purple} small />}
                  {profile.cell_id && <Badge label={`📡 ${profile.cell_id}`} color={C.warning} small />}
                  {profile.cell_id_fixed && <Badge label="⚠️ Antenne fixe" color={C.danger} small />}
                  {profile.distinct_cell_ids > 0 && <Badge label={`${profile.distinct_cell_ids} antenne(s)`} color={C.teal} small />}
                </div>
                {fraudType && (
                  <div style={{ marginTop: 10 }}>
                    <Badge label={fraudType} color={C.danger} />
                  </div>
                )}
              </div>
              <div style={{ textAlign: "center", background: riskColor + "10", borderRadius: 12, padding: "16px 24px", border: `1px solid ${riskColor}33` }}>
                <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Risque global</div>
                <div style={{ fontSize: 52, fontWeight: 900, color: riskColor, lineHeight: 1 }}>{Math.round(globalRisk)}</div>
                <Badge label={riskLabel} color={riskColor} />
              </div>
            </div>
          </Card>

          {/* ── Analyse rapide ─────────────────────────────────────────── */}
          {(() => {
            const flags = [];
            if ((profile.score_simbox || 0) >= 70) flags.push({ color: C.danger, icon: "📦", text: `SIM Box probable — score ${Math.round(profile.score_simbox)}/100`, detail: "Antenne fixe, zéro data, appels massifs" });
            if ((profile.score_wangiri || 0) >= 70) flags.push({ color: C.danger, icon: "📞", text: `Wangiri probable — score ${Math.round(profile.score_wangiri)}/100`, detail: "Appels courts séquentiels vers numéros premium" });
            if ((profile.score_ato || 0) >= 70) flags.push({ color: C.danger, icon: "🔓", text: `ATO probable — score ${Math.round(profile.score_ato)}/100`, detail: "Account Takeover — activité MM suspecte" });
            if ((profile.score_irsf || 0) >= 70) flags.push({ color: C.warning, icon: "🌍", text: `IRSF probable — score ${Math.round(profile.score_irsf)}/100`, detail: "Trafic international massif vers numéros surtaxés" });
            if (profile.cell_id_fixed) flags.push({ color: C.warning, icon: "📡", text: "Antenne fixe détectée", detail: `SIM toujours sur ${profile.cell_id} — indicateur SIM Box` });
            if (simSwaps.length > 0) flags.push({ color: C.danger, icon: "🔄", text: `${simSwaps.length} SIM Swap(s) détecté(s)`, detail: "Risque ATO élevé après changement de SIM" });
            if (relatedAlerts.length > 0) flags.push({ color: C.danger, icon: "⚠️", text: `${relatedAlerts.length} alerte(s) générée(s)`, detail: [...new Set(relatedAlerts.map(a => a.fraud_type))].join(", ") });
            if (flags.length === 0) flags.push({ color: C.success, icon: "✅", text: "Aucun indicateur de fraude", detail: "Comportement normal" });
            return (
              <Card style={{ padding: "16px 20px", marginBottom: 14, borderLeft: `4px solid ${flags[0].color}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>🔎 Analyse rapide</div>
                {flags.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, background: f.color + "08", borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{f.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: f.color }}>{f.text}</div>
                      <div style={{ fontSize: 11, color: C.textL, marginTop: 2 }}>{f.detail}</div>
                    </div>
                  </div>
                ))}
              </Card>
            );
          })()}

          {/* ── Scores + Radar ─────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
            <Card style={{ flex: 1, padding: "18px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>🎯 Scores de fraude</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                <ScoreGauge label="SIM Box" score={profile.score_simbox} />
                <ScoreGauge label="Wangiri"  score={profile.score_wangiri} />
                <ScoreGauge label="ATO"      score={profile.score_ato} />
                <ScoreGauge label="IRSF"     score={profile.score_irsf} />
              </div>
            </Card>
            <Card style={{ flex: 1, padding: "18px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>📊 Radar de risque</div>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke={C.mutedL} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: C.muted, fontSize: 11 }} />
                  <Radar dataKey="A" stroke={C.orange} fill={C.orange} fillOpacity={0.18} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* ── Stats CDR ──────────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <StatBox icon="📤" value={profile.call_out_count ?? "—"} label="Appels sortants" />
            <StatBox icon="📥" value={profile.call_in_count ?? "—"} label="Appels entrants" />
            <StatBox icon="⏱️" value={profile.avg_duration_out ? Math.round(profile.avg_duration_out) + "s" : "—"} label="Durée moy." />
            <StatBox icon="💬" value={profile.sms_out_count ?? "—"} label="SMS sortants" />
            <StatBox icon="⚡" value={profile.velocity_calls_per_min ? profile.velocity_calls_per_min.toFixed(2) : "—"} label="Vélocité/min" color={C.warning} />
            <StatBox icon="🌍" value={profile.call_intl_out_count ?? "—"} label="Appels intl" />
            <StatBox icon="🔄" value={simSwaps.length} label="SIM Swaps" color={simSwaps.length > 0 ? C.danger : C.success} />
            <StatBox icon="⚠️" value={relatedAlerts.length} label="Alertes" color={relatedAlerts.length > 0 ? C.danger : C.success} />
          </div>

          {/* ── CDR récent + Alertes ──────────────────────────────────── */}
          <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
            {/* CDR Voice */}
            <Card style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.mutedL}`, fontSize: 13, fontWeight: 700, color: C.navy }}>
                📞 CDR Voice récent ({cdrHistory.length})
              </div>
              {cdrHistory.length === 0
                ? <div style={{ padding: "20px 16px", color: C.muted, fontSize: 12 }}>Aucun CDR voice trouvé</div>
                : <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: C.bg }}>
                          {["Numéro B", "Durée (s)", "Cell", "Date", "Type", "Flag"].map(h => (
                            <th key={h} style={{ padding: "8px 12px", color: C.muted, textAlign: "left", fontWeight: 700, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cdrHistory.map((c, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${C.mutedL}` }}>
                            <td style={{ padding: "8px 12px", fontFamily: "monospace", color: C.navy }}>{c.msisdn_b || "—"}</td>
                            <td style={{ padding: "8px 12px", color: C.textL }}>{c.duration_sec ?? "—"}</td>
                            <td style={{ padding: "8px 12px", color: C.muted, fontSize: 11 }}>{c.cell_id || "—"}</td>
                            <td style={{ padding: "8px 12px", color: C.muted, fontSize: 11 }}>
                              {c.start_time ? new Date(c.start_time).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                            </td>
                            <td style={{ padding: "8px 12px" }}>
                              <span style={{ fontSize: 10, color: c.is_international ? C.warning : C.muted }}>
                                {c.is_international ? "🌍 Intl" : c.call_type || "Local"}
                              </span>
                            </td>
                            <td style={{ padding: "8px 12px" }}>
                              {c.is_premium ? <Badge label="Premium" color={C.danger} small /> : <span style={{ color: C.success }}>✓</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </Card>

            {/* Alertes */}
            <Card style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.mutedL}`, fontSize: 13, fontWeight: 700, color: C.navy, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>⚠️ Alertes liées ({relatedAlerts.length})</span>
                {actionDone && <span style={{ fontSize: 11, color: C.success, fontWeight: 600 }}>✓ {statusLabel(actionDone.newStatus)}</span>}
              </div>
              {relatedAlerts.length === 0
                ? <div style={{ padding: "20px 16px", color: C.muted, fontSize: 12 }}>Aucune alerte associée</div>
                : relatedAlerts.map((a, i) => {
                  const currentStatus = localAlertStatuses[a.id] || a.status;
                  const isActive = !['blocked', 'false_positive', 'cleared'].includes(currentStatus);
                  return (
                    <div key={i} style={{ padding: "12px 16px", borderBottom: `1px solid ${C.mutedL}`, background: !isActive ? C.bg : C.white }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isActive ? 10 : 0 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{a.fraud_type}</div>
                          <div style={{ fontSize: 10, color: C.muted }}>
                            {a.detected_at ? new Date(a.detected_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16, fontWeight: 900, color: (a.score || 0) >= 80 ? C.danger : C.warning }}>{a.score}</span>
                          <Badge label={statusLabel(currentStatus)} color={statusColor(currentStatus)} small />
                        </div>
                      </div>
                      {isActive && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <Btn variant="danger" small disabled={!!actionLoading} onClick={() => handleAlertAction(a.id, 'block', a.operator_id)}>
                            {actionLoading === a.id + 'block' ? '…' : '🚫 Bloquer'}
                          </Btn>
                          <Btn variant="warning" small disabled={!!actionLoading} onClick={() => handleAlertAction(a.id, 'investigate', a.operator_id)}>
                            {actionLoading === a.id + 'investigate' ? '…' : '🔍 En cours'}
                          </Btn>
                          <Btn variant="sky" small disabled={!!actionLoading} onClick={() => handleAlertAction(a.id, 'false_positive', a.operator_id)}>
                            {actionLoading === a.id + 'false_positive' ? '…' : '✓ Faux positif'}
                          </Btn>
                          <Btn variant="success" small disabled={!!actionLoading} onClick={() => handleAlertAction(a.id, 'clear', a.operator_id)}>
                            {actionLoading === a.id + 'clear' ? '…' : '✓ Clôturer'}
                          </Btn>
                        </div>
                      )}
                      {!isActive && <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>Alerte traitée</div>}
                    </div>
                  );
                })
              }
              {relatedAlerts.length > 0 && (
                <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.mutedL}`, background: C.bg }}>
                  <Btn variant="primary" style={{ width: "100%", justifyContent: "center", background: C.danger, border: "none" }}
                    onClick={async () => {
                      if (!window.confirm(`Bloquer définitivement ${searchMsisdn} ?`)) return;
                      for (const a of relatedAlerts) {
                        const s = localAlertStatuses[a.id] || a.status;
                        if (!['blocked', 'false_positive', 'cleared'].includes(s)) await handleAlertAction(a.id, 'block', a.operator_id);
                      }
                    }}>
                    🚫 Bloquer {searchMsisdn} — toutes les alertes
                  </Btn>
                </div>
              )}
            </Card>
          </div>

          {/* ── Actions listes ─────────────────────────────────────────── */}
          <Card style={{ padding: "16px 20px", marginBottom: 14, borderLeft: `4px solid ${C.purple}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>🛡️ Actions sur ce profil</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {[
                { title: `MSISDN — ${profile.msisdn}`, entity: "msisdn", value: profile.msisdn, show: true },
                { title: `IMEI — ${profile.imei?.slice(0,8)}…`, entity: "imei", value: profile.imei, show: !!profile.imei },
                { title: `Cell ID — ${profile.cell_id}`, entity: "cell_id", value: profile.cell_id, show: !!profile.cell_id },
              ].filter(e => e.show).map(ent => (
                <div key={ent.entity} style={{ background: C.bg, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 10 }}>{ent.title}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { label: "🚫 Blacklister", list: "blacklist", color: C.danger },
                      { label: "✅ Whitelister", list: "whitelist", color: C.success, onlyMsisdn: true },
                      { label: "👁️ Watchlist",   list: "watchlist", color: C.warning },
                    ].filter(opt => !opt.onlyMsisdn || ent.entity === "msisdn").map(opt => (
                      <button key={opt.list}
                        onClick={async () => {
                          if (!window.confirm(`${opt.label} le ${ent.entity} ${ent.value} ?`)) return;
                          const opId = relatedAlerts[0]?.operator_id || null;
                          const { error: e1 } = await supabase.from("control_lists").insert([{
                            list_type: opt.list, entry_type: ent.entity, value: ent.value, reason: `SimProfile — ${opt.list}`, active: true,
                          }]);
                          if (e1) { alert(`Erreur: ${e1.message}`); return; }
                          if (addEntry) addEntry({ list: opt.list, type: ent.entity, value: ent.value, reason: "SimProfile" }, opId);
                          addLog?.(`${opt.list.toUpperCase()}_${ent.entity.toUpperCase()}`, "control_list", ent.value, `${opt.label} ${ent.entity}`, "SimProfile");
                          alert(`✓ ${ent.value} ajouté en ${opt.list}`);
                        }}
                        style={{ padding: "7px 10px", background: opt.color + "15", border: `1px solid ${opt.color}44`,
                          color: opt.color, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* ── SIM Swaps + Antennes ──────────────────────────────────── */}
          <div style={{ display: "flex", gap: 14 }}>
            <Card style={{ flex: 1, padding: "18px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>🔄 SIM Swaps ({simSwaps.length})</div>
              {simSwaps.length === 0
                ? <div style={{ color: C.success, fontSize: 12 }}>✓ Aucun SIM Swap détecté</div>
                : simSwaps.map((s, i) => (
                  <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${C.mutedL}` }}>
                    <div style={{ fontSize: 12, color: C.navy, fontFamily: "monospace" }}>
                      {s.old_imsi || s.old_imei || "—"} → {s.new_imsi || s.new_imei || "—"}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
                      {s.swap_reason || "—"} · {s.swapped_at ? new Date(s.swapped_at).toLocaleString("fr-FR") : "—"}
                    </div>
                  </div>
                ))
              }
            </Card>

            <Card style={{ flex: 1, padding: "18px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>📡 Antennes fréquentées ({cellMovements.length})</div>
              {cellMovements.length === 0
                ? <div style={{ color: C.muted, fontSize: 12 }}>Aucune donnée antenne dans les CDR</div>
                : cellMovements.slice(0, 6).map((c, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.mutedL}` }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.navy, fontFamily: "monospace" }}>{c.cellId}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ height: 6, width: Math.max(20, Math.round((c.count / (cellMovements[0]?.count || 1)) * 80)), background: i === 0 ? C.orange : C.sky, borderRadius: 3 }} />
                      <span style={{ fontSize: 11, color: C.muted, minWidth: 28 }}>{c.count}x</span>
                    </div>
                  </div>
                ))
              }
              {cellMovements.length === 1 && (
                <div style={{ marginTop: 10, fontSize: 11, color: C.danger, fontWeight: 600, background: C.dangerL, borderRadius: 6, padding: "6px 10px" }}>
                  ⚠️ SIM fixe sur une seule antenne — indicateur SIM Box fort
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
