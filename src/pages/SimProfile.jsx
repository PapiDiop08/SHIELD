// ── SHIELD SimProfile Page — FULL LINK ───────────────────────────────────────
// Colonnes réelles Supabase vérifiées

import { useState, useEffect, useCallback } from "react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { C, sevColor, statusColor, statusLabel } from "../theme.js";
import { Card, Badge, Btn } from "../components.jsx";
import { supabase } from "../supabase.js";

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
  setBlacklist, setBlockings, blacklist, alerts: propAlerts, users, addLog, currentUser }) {

  const [inputMsisdn, setInputMsisdn] = useState(initMsisdn || "");
  const [searchMsisdn, setSearchMsisdn] = useState(initMsisdn || "");

  const { profile, cdrHistory, simSwaps, relatedAlerts, cellMovements,
          loading, error, fetchProfile } = useSimProfile(searchMsisdn);

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
          <p style={{ margin: "3px 0 0", color: C.textL, fontSize: 12 }}>Analyse complète depuis les CDR Supabase</p>
        </div>
      </div>

      {/* Recherche */}
      <form onSubmit={handleSearch} style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <input value={inputMsisdn} onChange={e => setInputMsisdn(e.target.value)}
          placeholder="Entrer un MSISDN (ex: 221776540001)"
          style={{ flex: 1, minWidth: 220, border: `1px solid ${C.mutedL}`, borderRadius: 8,
            padding: "9px 12px", fontSize: 13, color: C.navy, outline: "none" }} />
        <Btn type="submit">🔍 Analyser</Btn>
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
          <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
          <div>Entrez un MSISDN pour analyser son profil</div>
        </Card>
      )}
      {loading && <Card style={{ padding: "60px", textAlign: "center", color: C.muted }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
        <div>Chargement depuis Supabase…</div>
      </Card>}
      {error && <div style={{ background: C.dangerL, border: `1px solid ${C.danger}44`,
        borderRadius: 10, padding: 16, color: C.danger, marginBottom: 16 }}>⚠️ {error}</div>}
      {!loading && searchMsisdn && !profile && !error && (
        <Card style={{ padding: "60px", textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div>Aucun CDR trouvé pour <strong style={{ color: C.navy }}>{searchMsisdn}</strong></div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
            Ce MSISDN n'est pas dans les CDR Supabase
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
                  {profile.cell_id_fixed && <Badge label="Antenne fixe ⚠" color={C.danger} small />}
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
            if ((profile.score_simbox || 0) >= 70) flags.push({ color: C.danger, icon: "📦",
              text: `SIM Box probable — score ${Math.round(profile.score_simbox)}/100`,
              detail: "Antenne fixe, zéro data, appels massifs" });
            if ((profile.score_wangiri || 0) >= 70) flags.push({ color: C.danger, icon: "📞",
              text: `Wangiri probable — score ${Math.round(profile.score_wangiri)}/100`,
              detail: "Appels courts séquentiels vers numéros premium" });
            if ((profile.score_ato || 0) >= 70) flags.push({ color: C.danger, icon: "🔓",
              text: `ATO probable — score ${Math.round(profile.score_ato)}/100`,
              detail: "Account Takeover — activité MM suspecte" });
            if ((profile.score_irsf || 0) >= 70) flags.push({ color: C.warning, icon: "🌍",
              text: `IRSF probable — score ${Math.round(profile.score_irsf)}/100`,
              detail: "Trafic international massif vers numéros surtaxés" });
            if (profile.cell_id_fixed) flags.push({ color: C.warning, icon: "📡",
              text: "Antenne fixe détectée",
              detail: `SIM toujours sur ${profile.cell_id} — indicateur SIM Box` });
            if (simSwaps.length > 0) flags.push({ color: C.danger, icon: "🔄",
              text: `${simSwaps.length} SIM Swap(s)`,
              detail: "Risque ATO élevé après changement de SIM" });
            if (relatedAlerts.length > 0) flags.push({ color: C.danger, icon: "🚨",
              text: `${relatedAlerts.length} alerte(s) générée(s)`,
              detail: [...new Set(relatedAlerts.map(a => a.fraud_type))].join(", ") });
            if (flags.length === 0) flags.push({ color: C.success, icon: "✅",
              text: "Aucun indicateur de fraude", detail: "Comportement normal" });
            return (
              <Card style={{ padding: "16px 20px", marginBottom: 14, borderLeft: `4px solid ${flags[0].color}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>⚡ Analyse rapide</div>
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
              { l: "Appels sortants",   v: profile.call_out_count ?? "—",       icon: "📞" },
              { l: "Appels entrants",   v: profile.call_in_count ?? "—",        icon: "📲" },
              { l: "Durée moy (s)",     v: profile.avg_duration_out ? Math.round(profile.avg_duration_out) : "—", icon: "⏱" },
              { l: "SMS sortants",      v: profile.sms_out_count ?? "—",        icon: "💬" },
              { l: "Vélocité/min",      v: profile.velocity_calls_per_min ? profile.velocity_calls_per_min.toFixed(2) : "—", icon: "⚡" },
              { l: "Appels intl",       v: profile.call_intl_out_count ?? "—",  icon: "🌍" },
              { l: "SIM Swaps",         v: simSwaps.length,                      icon: "🔄" },
              { l: "Alertes liées",     v: relatedAlerts.length,                 icon: "🚨" },
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
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>💸 Mobile Money</div>
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
                                {c.is_international ? "🌍 Intl" : c.call_type || "Local"}
                              </span>
                            </td>
                            <td style={{ padding: "8px 12px" }}>
                              {c.is_premium
                                ? <Badge label="Premium" color={C.danger} small />
                                : <span style={{ color: C.success, fontSize: 12 }}>✓</span>}
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
                fontSize: 13, fontWeight: 700, color: C.navy }}>
                Alertes liées ({relatedAlerts.length})
              </div>
              {relatedAlerts.length === 0
                ? <div style={{ padding: 20, color: C.muted, fontSize: 12 }}>Aucune alerte associée</div>
                : relatedAlerts.map((a, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between",
                    alignItems: "center", padding: "10px 16px", borderBottom: `1px solid ${C.mutedL}` }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{a.fraud_type}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>
                        {a.triggered_rule_name || "—"} · {a.detected_at ? new Date(a.detected_at).toLocaleDateString("fr-FR") : "—"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 900,
                        color: (a.score || 0) >= 80 ? C.danger : C.warning }}>{a.score}</span>
                      <Badge label={statusLabel(a.status)} color={statusColor(a.status)} small />
                    </div>
                  </div>
                ))
              }
            </Card>
          </div>

          {/* SIM Swaps + Antennes */}
          <div style={{ display: "flex", gap: 14 }}>
            <Card style={{ flex: 1, padding: "18px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>
                SIM Swaps ({simSwaps.length})
              </div>
              {simSwaps.length === 0
                ? <div style={{ color: C.success, fontSize: 12 }}>✓ Aucun SIM Swap détecté</div>
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
                  ⚠ SIM fixe sur une seule antenne — indicateur SIM Box fort
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}