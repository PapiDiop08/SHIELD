// ── SHIELD SimProfile Page — FULL LINK ───────────────────────────────────────
// Colonnes réelles AAR DB vérifiées

import { useState, useEffect, useCallback } from "react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { C, sevColor, statusColor, statusLabel } from "../theme.js";
import { Card, Badge, Btn } from "../components.jsx";
import { supabase } from "../supabase.js";
import { blockAndBlacklist } from "../blockAndBlacklist.js";

// ── Actions sur une alerte depuis SimProfile ──────────────────────────────
async function applyAlertAction(alertId, action, msisdn, operatorId, addLog, setBlockings) {
  // 1. Mettre à jour le statut dans AAR DB
  const statusMap = {
    block:          'blocked',
    investigate:    'investigating',
    false_positive: 'false_positive',
    clear:          'cleared',
    alert:          'alert',
  };
  const newStatus = statusMap[action] || action;
  await supabase.from('alerts').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', alertId);

  // 2. Si blocage — créer un blocking
  if (action === 'block' && msisdn && operatorId) {
    const { data: existing } = await supabase.from('blockings')
      .select('id').eq('msisdn', msisdn).eq('active', true).maybeSingle();
    if (!existing) {
      await supabase.from('blockings').insert([{
        operator_id: operatorId,
        msisdn,
        reason: 'Blocage manuel depuis SimProfile — Analyse analyste',
        source: 'analyst',
        active: true,
        blocked_at: new Date().toISOString(),
      }]);
    }
  }

  // 3. Log
  addLog?.('UPDATE_ALERT_STATUS', 'alert', alertId, `SimProfile → ${newStatus} — ${msisdn}`, 'SimProfile');
  return newStatus;
}

// ── Hook profil complet SIM ───────────────────────────────────────────────
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
    setLoading(true);
    setError(null);
    try {
      // Tout en parallèle
      const [simRes, cdrRes, swapRes, alertRes, cellRes, smsRes] = await Promise.all([
        // v_sim_profile — tous les agrégats + scores
        supabase.from("v_sim_profile").select("*").eq("msisdn", target).maybeSingle(),
        // CDR Voice — msisdn_a, msisdn_b, duration_sec, cell_id, start_time
        supabase.from("cdr_voice")
          .select("msisdn_a, msisdn_b, imsi, imei, cell_id, duration_sec, start_time, call_type, is_international, is_premium, country_code_b")
          .eq("msisdn_a", target)
          .order("start_time", { ascending: false })
          .limit(10),
        // SIM Swaps
        supabase.from("sim_swap_history")
          .select("msisdn, old_imsi, new_imsi, old_imei, new_imei, swap_reason, swap_channel, swapped_at")
          .eq("msisdn", target)
          .order("swapped_at", { ascending: false }),
        // Alertes liées
        supabase.from("alerts")
          .select("id, fraud_type, status, score, detected_at, triggered_rule_name")
          .eq("msisdn", target)
          .order("detected_at", { ascending: false })
          .limit(10),
        // Cell IDs depuis CDR voice
        supabase.from("cdr_voice")
          .select("cell_id")
          .eq("msisdn_a", target)
          .limit(500),
        // SMS count
        supabase.from("cdr_sms")
          .select("msisdn_a, sms_type")
          .eq("msisdn_a", target)
          .limit(200),
      ]);

      const simData  = simRes.data;
      const cdrVoice = cdrRes.data || [];
      const swaps    = swapRes.data || [];
      const alerts   = alertRes.data || [];
      const cellsRaw = cellRes.data || [];
      const smsRaw   = smsRes.data || [];

      // Agréger cell_ids
      const cellCount = {};
      cellsRaw.forEach(r => {
        if (r.cell_id) cellCount[r.cell_id] = (cellCount[r.cell_id] || 0) + 1;
      });
      const cellMoves = Object.entries(cellCount)
        .map(([cellId, count]) => ({ cellId, count }))
        .sort((a, b) => b.count - a.count);

      // Si pas de v_sim_profile mais CDR existe — construire profil minimal
      const enriched = simData || (cdrVoice.length > 0 ? {
        msisdn: target,
        imei: cdrVoice[0]?.imei || null,
        imsi: cdrVoice[0]?.imsi || null,
        cell_id: cellMoves[0]?.cellId || null,
        call_out_count: cdrVoice.length,
        call_in_count: 0,
        avg_duration_out: cdrVoice.reduce((s,r) => s + (r.duration_sec||0), 0) / (cdrVoice.length||1),
        sms_out_count: smsRaw.length,
        velocity_calls_per_min: 0,
        distinct_cell_ids: cellMoves.length,
        cell_id_fixed: cellMoves.length === 1,
        score_simbox: 0, score_wangiri: 0, score_ato: 0, score_irsf: 0,
      } : null);

      setProfile(enriched);
      setCdrHistory(cdrVoice);
      setSimSwaps(swaps);
      setRelatedAlerts(alerts);
      setCellMovements(cellMoves);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (msisdn) fetch(msisdn); }, [msisdn, fetch]);
  return { profile, cdrHistory, simSwaps, relatedAlerts, cellMovements, loading, error, fetchProfile: fetch };
}

// ── Jauge score ───────────────────────────────────────────────────────────
function ScoreGauge({ label, score }) {
  const s = Math.round(score || 0);
  const color = s >= 80 ? C.danger : s >= 50 ? C.warning : s >= 30 ? C.sky : C.success;
  return (
    <div style={{ textAlign: "center", padding: "10px 0" }}>
      <div style={{ width: 60, height: 60, borderRadius: "50%", border: `4px solid ${color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 6px", background: color + "10" }}>
        <span style={{ fontSize: 18, fontWeight: 900, color }}>{s}</span>
      </div>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────
export default function SimProfile({ msisdn: initMsisdn, score: initScore, fraudType, onBack,
  setBlacklist, setBlockings, blacklist, alerts: propAlerts, users, addLog, currentUser,
  addEntry, createBlocking, operators }) {

  const [inputMsisdn, setInputMsisdn] = useState(initMsisdn || "");
  const [searchMsisdn, setSearchMsisdn] = useState(initMsisdn || "");
  const [actionLoading, setActionLoading] = useState(null);
  const [actionDone, setActionDone] = useState(null);
  const [localAlertStatuses, setLocalAlertStatuses] = useState({});

  const { profile, cdrHistory, simSwaps, relatedAlerts, cellMovements,
          loading, error, fetchProfile } = useSimProfile(searchMsisdn);

  // Action sur une alerte — met à jour localement + AAR DB
  // Si BLOCAGE : toutes les alertes du MSISDN sont bloquées
  async function handleAlertAction(alertId, action, operatorId) {
    setActionLoading(alertId + action);
    try {
      const newStatus = await applyAlertAction(alertId, action, searchMsisdn, operatorId, addLog, setBlockings);

      if (action === 'block') {
        // Bloquer + Blacklister MSISDN + IMEI + Cell en une fois
        const opId = relatedAlerts[0]?.operator_id || null;
        const blockResults = await blockAndBlacklist({
          msisdn: searchMsisdn,
          imei: profile?.imei || null,
          imsi: profile?.imsi || null,
          cell_id: profile?.cell_id || null,
          operatorId: opId,
          reason: `Blocage SimProfile — ${fraudType || 'Fraude'} — Score ${initScore}`,
          addLog,
        });
        if (blockResults.errors.length > 0) {
          console.warn("Blocage partiel:", blockResults.errors.join(", "));
        }
        // Rafraîchir la page blocages
        if (createBlocking) createBlocking({ msisdn: searchMsisdn }, opId);

        // Mettre à jour l'état local
        const allBlocked = {};
        relatedAlerts.forEach(a => { allBlocked[a.id] = 'blocked'; });
        setLocalAlertStatuses(allBlocked);
        addLog?.('BLOCK_SIM', 'msisdn', searchMsisdn,
          `Blocage ${searchMsisdn} — ${relatedAlerts.length} alerte(s) bloquées`, 'SimProfile');
      } else {
        // Pour les autres actions — seulement l'alerte cliquée
        setLocalAlertStatuses(p => ({ ...p, [alertId]: newStatus }));
      }

      setActionDone({ alertId, action, newStatus });
      setTimeout(() => setActionDone(null), 3000);

      // Retour auto si action terminale
      if (['blocked', 'false_positive', 'cleared'].includes(newStatus) && onBack) {
        setTimeout(() => onBack(), 1500);
      }
    } catch (err) {
      console.error('Action error:', err);
    } finally {
      setActionLoading(null);
    }
  }

  const QUICK = ["221776540001", "221776300001", "221775430001", "221778901001"];

  const handleSearch = (e) => {
    e.preventDefault();
    if (inputMsisdn.trim()) {
      setSearchMsisdn(inputMsisdn.trim());
      fetchProfile(inputMsisdn.trim());
    }
  };

  const globalRisk = profile
    ? Math.max(profile.score_simbox || 0, profile.score_wangiri || 0,
               profile.score_ato || 0, profile.score_irsf || 0)
    : (initScore || 0);

  const riskColor = globalRisk >= 80 ? C.danger : globalRisk >= 50 ? C.warning
                  : globalRisk >= 30 ? C.sky : C.success;
  const riskLabel = globalRisk >= 80 ? "Critique" : globalRisk >= 50 ? "Élevé"
                  : globalRisk >= 30 ? "Moyen" : "Faible";

  const radarData = [
    { subject: "SIM Box", A: profile?.score_simbox || 0 },
    { subject: "Wangiri",  A: profile?.score_wangiri || 0 },
    { subject: "ATO",      A: profile?.score_ato || 0 },
    { subject: "IRSF",     A: profile?.score_irsf || 0 },
  ];

  return (
    <div style={{ padding: "28px 30px", fontFamily: "\'DM Sans\',\'Segoe UI\',sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        {onBack && <Btn variant="ghost" onClick={onBack}>← Retour</Btn>}
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: C.navy }}>Profil SIM</h1>
          <p style={{ margin: "3px 0 0", color: C.textL, fontSize: 12 }}>Analyse complète depuis les CDR</p>
        </div>
      </div>

      {/* Recherche */}
      <form onSubmit={handleSearch} style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <input value={inputMsisdn} onChange={e => setInputMsisdn(e.target.value)}
          placeholder="Entrer un MSISDN (ex: 221776540001)"
          style={{ flex: 1, minWidth: 220, border: `1px solid ${C.mutedL}`, borderRadius: 8,
            padding: "9px 12px", fontSize: 13, color: C.navy, outline: "none" }} />
        <Btn type="submit">Rch Analyser</Btn>
      </form>

      {/* Quick picks */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.muted }}>Suspects :</span>
        {QUICK.map(m => (
          <button key={m} onClick={() => { setInputMsisdn(m); setSearchMsisdn(m); fetchProfile(m); }}
            style={{ padding: "3px 10px", background: C.dangerL, color: C.danger,
              border: `1px solid ${C.danger}33`, borderRadius: 6, fontSize: 11,
              cursor: "pointer", fontFamily: "monospace" }}>
            {m}
          </button>
        ))}
      </div>

      {/* États */}
      {!searchMsisdn && (
        <Card style={{ padding: "60px", textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>MOB</div>
          <div>Entrez un MSISDN pour analyser son profil</div>
        </Card>
      )}
      {loading && <Card style={{ padding: "60px", textAlign: "center", color: C.muted }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>…</div>
        <div>Chargement chargement…</div>
      </Card>}
      {error && <div style={{ background: C.dangerL, border: `1px solid ${C.danger}44`,
        borderRadius: 10, padding: 16, color: C.danger, marginBottom: 16 }}>! {error}</div>}
      {!loading && searchMsisdn && !profile && !error && (
        <Card style={{ padding: "60px", textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>Rch</div>
          <div>Aucun CDR trouvé pour <strong style={{ color: C.navy }}>{searchMsisdn}</strong></div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
            Ce MSISDN n'est pas dans les CDR
          </div>
        </Card>
      )}

      {profile && !loading && (
        <>
          {/* Identité */}
          <Card style={{ padding: "20px 24px", marginBottom: 14, borderLeft: `4px solid ${riskColor}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.navy,
                  letterSpacing: 1, fontFamily: "monospace" }}>{profile.msisdn}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {profile.imei && <Badge label={`IMEI: ${profile.imei}`} color={C.sky} small />}
                  {profile.imei_prefix6 && <Badge label={`Préfixe: ${profile.imei_prefix6}`} color={C.purple} small />}
                  {profile.cell_id && <Badge label={`Cell: ${profile.cell_id}`} color={C.warning} small />}
                  {profile.cell_id_fixed && <Badge label="Antenne fixe !" color={C.danger} small />}
                  {profile.distinct_cell_ids > 0 && <Badge label={`${profile.distinct_cell_ids} antenne(s)`} color={C.teal} small />}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Risque global</div>
                <div style={{ fontSize: 44, fontWeight: 900, color: riskColor, lineHeight: 1 }}>
                  {Math.round(globalRisk)}
                </div>
                <Badge label={riskLabel} color={riskColor} small />
              </div>
            </div>
          </Card>

          {/* Analyse rapide */}
          {(() => {
            const flags = [];
            if ((profile.score_simbox || 0) >= 70) flags.push({ color: C.danger, icon: "Pack",
              text: `SIM Box probable — score ${Math.round(profile.score_simbox)}/100`,
              detail: "Antenne fixe, zéro data, appels massifs" });
            if ((profile.score_wangiri || 0) >= 70) flags.push({ color: C.danger, icon: "TEL",
              text: `Wangiri probable — score ${Math.round(profile.score_wangiri)}/100`,
              detail: "Appels courts séquentiels vers numéros premium" });
            if ((profile.score_ato || 0) >= 70) flags.push({ color: C.danger, icon: "OPN",
              text: `ATO probable — score ${Math.round(profile.score_ato)}/100`,
              detail: "Account Takeover — activité MM suspecte" });
            if ((profile.score_irsf || 0) >= 70) flags.push({ color: C.warning, icon: "GEO",
              text: `IRSF probable — score ${Math.round(profile.score_irsf)}/100`,
              detail: "Trafic international massif vers numéros surtaxés" });
            if (profile.cell_id_fixed) flags.push({ color: C.warning, icon: "ANT",
              text: "Antenne fixe détectée",
              detail: `SIM toujours sur ${profile.cell_id} — indicateur SIM Box` });
            if (simSwaps.length > 0) flags.push({ color: C.danger, icon: "Sync",
              text: `${simSwaps.length} SIM Swap(s)`,
              detail: "Risque ATO élevé après changement de SIM" });
            if (relatedAlerts.length > 0) flags.push({ color: C.danger, icon: "!",
              text: `${relatedAlerts.length} alerte(s) générée(s)`,
              detail: [...new Set(relatedAlerts.map(a => a.fraud_type))].join(", ") });
            if (flags.length === 0) flags.push({ color: C.success, icon: "OK",
              text: "Aucun indicateur de fraude", detail: "Comportement normal" });
            return (
              <Card style={{ padding: "16px 20px", marginBottom: 14, borderLeft: `4px solid ${flags[0].color}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>API Analyse rapide</div>
                {flags.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10,
                    background: f.color + "08", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{f.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: f.color }}>{f.text}</div>
                      <div style={{ fontSize: 11, color: C.textL, marginTop: 2 }}>{f.detail}</div>
                    </div>
                  </div>
                ))}
              </Card>
            );
          })()}

          {/* Scores + Radar */}
          <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
            <Card style={{ flex: 1, padding: "18px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Scores de fraude</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                <ScoreGauge label="SIM Box" score={profile.score_simbox} />
                <ScoreGauge label="Wangiri"  score={profile.score_wangiri} />
                <ScoreGauge label="ATO"      score={profile.score_ato} />
                <ScoreGauge label="IRSF"     score={profile.score_irsf} />
              </div>
            </Card>
            <Card style={{ flex: 1, padding: "18px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 8 }}>Radar de risque</div>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke={C.mutedL} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: C.muted, fontSize: 11 }} />
                  <Radar dataKey="A" stroke={C.danger} fill={C.danger} fillOpacity={0.15} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Stats depuis v_sim_profile */}
          <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { l: "Appels sortants",   v: profile.call_out_count ?? "—",       icon: "TEL" },
              { l: "Appels entrants",   v: profile.call_in_count ?? "—",        icon: "IN" },
              { l: "Durée moy (s)",     v: profile.avg_duration_out ? Math.round(profile.avg_duration_out) : "—", icon: "⏱" },
              { l: "SMS sortants",      v: profile.sms_out_count ?? "—",        icon: "SMS" },
              { l: "Vélocité/min",      v: profile.velocity_calls_per_min ? profile.velocity_calls_per_min.toFixed(2) : "—", icon: "API" },
              { l: "Appels intl",       v: profile.call_intl_out_count ?? "—",  icon: "GEO" },
              { l: "SIM Swaps",         v: simSwaps.length,                      icon: "Sync" },
              { l: "Alertes liées",     v: relatedAlerts.length,                 icon: "!" },
            ].map((s, i) => (
              <Card key={i} style={{ flex: "1 1 120px", padding: "12px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: C.navy }}>{s.v}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{s.l}</div>
              </Card>
            ))}
          </div>

          {/* Stats MM si disponibles */}
          {(profile.mm_sent_count > 0 || profile.mm_sent_amount > 0) && (
            <Card style={{ padding: "16px 20px", marginBottom: 14, borderLeft: `4px solid ${C.teal}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>MM Mobile Money</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  { l: "Envois",           v: profile.mm_sent_count || 0 },
                  { l: "Montant envoyé",   v: `${(profile.mm_sent_amount || 0).toLocaleString()} XOF` },
                  { l: "Max transaction",  v: `${(profile.mm_max_single_tx || 0).toLocaleString()} XOF` },
                  { l: "Nv destinataires", v: `${profile.mm_new_recipients_pct ? profile.mm_new_recipients_pct.toFixed(0) : 0}%` },
                  { l: "Tentatives OTP",   v: profile.mm_otp_brute_count || 0 },
                ].map((s, i) => (
                  <div key={i} style={{ background: C.bg, borderRadius: 8, padding: "10px 14px", flex: 1, minWidth: 100 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.teal }}>{s.v}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* CDR récent + Alertes */}
          <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
            <Card style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.mutedL}`,
                fontSize: 13, fontWeight: 700, color: C.navy }}>
                CDR Voice récent ({cdrHistory.length})
              </div>
              {cdrHistory.length === 0
                ? <div style={{ padding: 20, color: C.muted, fontSize: 12 }}>Aucun CDR voice trouvé</div>
                : <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: C.bg }}>
                          {["Numéro B", "Durée (s)", "Cell", "Date", "Type", "Fraude"].map(h => (
                            <th key={h} style={{ padding: "8px 12px", color: C.muted, textAlign: "left",
                              fontWeight: 700, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
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
                                {c.is_international ? "GEO Intl" : c.call_type || "Local"}
                              </span>
                            </td>
                            <td style={{ padding: "8px 12px" }}>
                              {c.is_premium
                                ? <Badge label="Premium" color={C.danger} small />
                                : <span style={{ color: C.success, fontSize: 12 }}>v</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </Card>

            <Card style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.mutedL}`,
                fontSize: 13, fontWeight: 700, color: C.navy, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Alertes liées ({relatedAlerts.length})</span>
                {actionDone && (
                  <span style={{ fontSize: 11, color: C.success, fontWeight: 600 }}>
                    OK {statusLabel(actionDone.newStatus)} — retour dans 1s
                  </span>
                )}
              </div>
              {relatedAlerts.length === 0
                ? <div style={{ padding: 20, color: C.muted, fontSize: 12 }}>Aucune alerte associée</div>
                : relatedAlerts.map((a, i) => {
                  const currentStatus = localAlertStatuses[a.id] || a.status;
                  const isActive = !['blocked','false_positive','cleared'].includes(currentStatus);
                  return (
                    <div key={i} style={{
                      padding: "12px 16px", borderBottom: `1px solid ${C.mutedL}`,
                      background: !isActive ? C.bg : C.white,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isActive ? 10 : 0 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{a.fraud_type}</div>
                          <div style={{ fontSize: 10, color: C.muted }}>
                            {a.detected_at ? new Date(a.detected_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 900,
                            color: (a.score || 0) >= 80 ? C.danger : C.warning }}>{a.score}</span>
                          <Badge label={statusLabel(currentStatus)} color={statusColor(currentStatus)} small />
                        </div>
                      </div>
                      {/* Boutons d'action — visibles seulement si alerte active */}
                      {isActive && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            disabled={!!actionLoading}
                            onClick={() => handleAlertAction(a.id, 'block', a.operator_id)}
                            style={{ padding: "5px 12px", background: C.dangerL, border: `1px solid ${C.danger}44`,
                              color: C.danger, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            {actionLoading === a.id + 'block' ? '...' : '[X] Bloquer'}
                          </button>
                          <button
                            disabled={!!actionLoading}
                            onClick={() => handleAlertAction(a.id, 'investigate', a.operator_id)}
                            style={{ padding: "5px 12px", background: C.warningL, border: `1px solid ${C.warning}44`,
                              color: C.warning, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            {actionLoading === a.id + 'investigate' ? '...' : 'Rch En cours'}
                          </button>
                          <button
                            disabled={!!actionLoading}
                            onClick={() => handleAlertAction(a.id, 'false_positive', a.operator_id)}
                            style={{ padding: "5px 12px", background: C.skyL, border: `1px solid ${C.sky}44`,
                              color: C.sky, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            {actionLoading === a.id + 'false_positive' ? '...' : 'v Faux positif'}
                          </button>
                          <button
                            disabled={!!actionLoading}
                            onClick={() => handleAlertAction(a.id, 'clear', a.operator_id)}
                            style={{ padding: "5px 12px", background: C.successL, border: `1px solid ${C.success}44`,
                              color: C.success, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            {actionLoading === a.id + 'clear' ? '...' : 'OK Clôturer'}
                          </button>
                        </div>
                      )}
                      {!isActive && (
                        <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>
                          Alerte traitée — retirée des détections actives
                        </div>
                      )}
                    </div>
                  );
                })
              }
              {/* Bouton bloquer le MSISDN globalement */}
              {relatedAlerts.length > 0 && (
                <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.mutedL}`, background: C.bg }}>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Bloquer définitivement ${searchMsisdn} sur toutes ses alertes ?`)) return;
                      for (const a of relatedAlerts) {
                        const s = localAlertStatuses[a.id] || a.status;
                        if (!['blocked','false_positive','cleared'].includes(s)) {
                          await handleAlertAction(a.id, 'block', a.operator_id);
                        }
                      }
                    }}
                    style={{ width: "100%", padding: "8px", background: C.danger, border: "none",
                      color: C.white, borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                    [X] Bloquer {searchMsisdn} — toutes les alertes
                  </button>
                </div>
              )}
            </Card>
          </div>

          {/* ── Actions sur le profil — Listes ── */}
          <Card style={{ padding: "16px 20px", marginBottom: 14, borderLeft: `4px solid ${C.purple}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>
              SEC Actions sur ce profil
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {/* MSISDN */}
              <div style={{ background: C.bg, borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 8 }}>
                  MSISDN — {profile.msisdn}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { label: "[X] Blacklister", list: "blacklist", color: C.danger },
                    { label: "OK Whitelister", list: "whitelist", color: C.success },
                    { label: "WATCH Watchlist",   list: "watchlist", color: C.warning },
                  ].map(opt => (
                    <button key={opt.list}
                      onClick={async () => {
                        if (!window.confirm(`${opt.label} le MSISDN ${profile.msisdn} ?`)) return;
                        const opId = relatedAlerts[0]?.operator_id || null;
                        const { data: d1, error: e1 } = await supabase.from("control_lists").insert([{
                          list_type: opt.list, entry_type: "msisdn",
                          value: profile.msisdn, reason: `SimProfile — ${opt.list}`, active: true,
                        }]).select();
                        if (e1) { alert(`Erreur: ${e1.message}`); return; }
                        // Refresh la liste
                        if (addEntry) addEntry({ list: opt.list, type: "msisdn", value: profile.msisdn, reason: `SimProfile` }, opId);
                        addLog?.(`${opt.list.toUpperCase()}_MSISDN`, "control_list", profile.msisdn,
                          `${opt.label} MSISDN ${profile.msisdn}`, "SimProfile");
                        alert(`OK ${profile.msisdn} ajouté en ${opt.list}`);
                      }}
                      style={{ padding: "6px 10px", background: opt.color + "15",
                        border: `1px solid ${opt.color}44`, color: opt.color,
                        borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* IMEI */}
              {profile.imei && (
                <div style={{ background: C.bg, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 8 }}>
                    IMEI — {profile.imei?.slice(0, 8)}…
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { label: "[X] Blacklister IMEI", list: "blacklist", color: C.danger },
                      { label: "WATCH Surveiller IMEI",  list: "watchlist", color: C.warning },
                    ].map(opt => (
                      <button key={opt.list}
                        onClick={async () => {
                          if (!window.confirm(`${opt.label} l'IMEI ${profile.imei} ?`)) return;
                          const opId = relatedAlerts[0]?.operator_id || null;
                          const { error: e2 } = await supabase.from("control_lists").insert([{
                            list_type: opt.list, entry_type: "imei",
                            value: profile.imei, reason: `SimProfile — ${opt.list} IMEI`, active: true,
                          }]).select();
                          if (e2) { alert(`Erreur IMEI: ${e2.message}`); return; }
                          if (addEntry) addEntry({ list: opt.list, type: "imei", value: profile.imei, reason: `SimProfile IMEI` }, opId);
                          addLog?.(`${opt.list.toUpperCase()}_IMEI`, "control_list", profile.imei,
                            `${opt.label} IMEI ${profile.imei}`, "SimProfile");
                          alert(`OK IMEI ${profile.imei?.slice(0,8)}... ajouté en ${opt.list}`);
                        }}
                        style={{ padding: "6px 10px", background: opt.color + "15",
                          border: `1px solid ${opt.color}44`, color: opt.color,
                          borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cell ID */}
              {profile.cell_id && (
                <div style={{ background: C.bg, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 8 }}>
                    Cell ID — {profile.cell_id}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { label: "[X] Blacklister Cell", list: "blacklist", color: C.danger },
                      { label: "WATCH Surveiller Cell",  list: "watchlist", color: C.warning },
                    ].map(opt => (
                      <button key={opt.list}
                        onClick={async () => {
                          if (!window.confirm(`${opt.label} le Cell ID ${profile.cell_id} ?`)) return;
                          const opId = relatedAlerts[0]?.operator_id || null;
                          const { error: e3 } = await supabase.from("control_lists").insert([{
                            list_type: opt.list, entry_type: "cell_id",
                            value: profile.cell_id, reason: `SimProfile — ${opt.list} Cell`, active: true,
                          }]).select();
                          if (e3) { alert(`Erreur Cell: ${e3.message}`); return; }
                          if (addEntry) addEntry({ list: opt.list, type: "cell_id", value: profile.cell_id, reason: `SimProfile Cell` }, opId);
                          addLog?.(`${opt.list.toUpperCase()}_CELL`, "control_list", profile.cell_id,
                            `${opt.label} Cell ${profile.cell_id}`, "SimProfile");
                          alert(`OK Cell ${profile.cell_id} ajouté en ${opt.list}`);
                        }}
                        style={{ padding: "6px 10px", background: opt.color + "15",
                          border: `1px solid ${opt.color}44`, color: opt.color,
                          borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* SIM Swaps + Antennes */}
          <div style={{ display: "flex", gap: 14 }}>
            <Card style={{ flex: 1, padding: "18px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>
                SIM Swaps ({simSwaps.length})
              </div>
              {simSwaps.length === 0
                ? <div style={{ color: C.success, fontSize: 12 }}>v Aucun SIM Swap détecté</div>
                : simSwaps.map((s, i) => (
                  <div key={i} style={{ padding: "8px 0", borderBottom: `1px solid ${C.mutedL}` }}>
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
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>
                Antennes fréquentées ({cellMovements.length})
              </div>
              {cellMovements.length === 0
                ? <div style={{ color: C.muted, fontSize: 12 }}>Aucune donnée antenne dans les CDR</div>
                : cellMovements.slice(0, 6).map((c, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between",
                    alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.mutedL}` }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.navy, fontFamily: "monospace" }}>
                      {c.cellId}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ height: 6,
                        width: Math.max(20, Math.round((c.count / (cellMovements[0]?.count || 1)) * 80)),
                        background: i === 0 ? C.danger : C.sky, borderRadius: 3 }} />
                      <span style={{ fontSize: 11, color: C.muted, minWidth: 28 }}>{c.count}x</span>
                    </div>
                  </div>
                ))
              }
              {cellMovements.length === 1 && (
                <div style={{ marginTop: 8, fontSize: 11, color: C.danger, fontWeight: 600 }}>
                  ! SIM fixe sur une seule antenne — indicateur SIM Box fort
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}