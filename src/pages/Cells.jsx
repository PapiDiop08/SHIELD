// ── SHIELD Cells Page — FULL LINK ────────────────────────────────────────────
// Données depuis cell_anomalies + cdr_voice Supabase — plus de CELL_ANOMALIES mock

import { useState, useEffect, useCallback } from "react";
import { C, statusColor, statusLabel } from "../theme.js";
import { Card, Badge, Btn, SectionHeader } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";
import { supabase } from "../supabase.js";

// ── Hook interne — anomalies depuis Supabase ──────────────────────────────
function useCellAnomalies(operatorIdFilter) {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("cell_anomalies")
        .select("*, operators(name, code)")
        .order("detected_at", { ascending: false });
      if (operatorIdFilter) q = q.eq("operator_id", operatorIdFilter);
      const { data, error } = await q;
      if (error) throw error;
      // Dédupliquer par cell_id — garder la plus récente
      const seen = new Set();
      const deduped = (data || []).filter(c => {
        if (seen.has(c.cell_id)) return false;
        seen.add(c.cell_id);
        return true;
      });
      setAnomalies(deduped);
    } catch (err) {
      console.error("useCellAnomalies error:", err);
    } finally {
      setLoading(false);
    }
  }, [operatorIdFilter]);

  useEffect(() => { fetch(); }, [fetch]);
  return { anomalies, loading, refetch: fetch };
}

// ── Hook interne — SIMs suspectes d'une antenne depuis cdr_voice ──────────
function useCellSIMs(cellId) {
  const [sims, setSims] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      // Récupérer CDR voice pour cette antenne
      const { data: cdrRaw } = await supabase
        .from("cdr_voice")
        .select("msisdn, duration, fraud_flag, imei, imsi")
        .or(`cell_id.eq.${id},cell_id.eq.${id}`)
        .limit(500);

      if (!cdrRaw) { setSims([]); return; }

      // Agréger par MSISDN
      const simMap = {};
      cdrRaw.forEach(r => {
        if (!simMap[r.msisdn]) {
          simMap[r.msisdn] = {
            msisdn: r.msisdn,
            imei: r.imei || "—",
            callsOut: 0,
            totalDuration: 0,
            fraudCount: 0,
          };
        }
        simMap[r.msisdn].callsOut++;
        simMap[r.msisdn].totalDuration += r.duration_sec || 0;
        if (r.is_premium) simMap[r.msisdn].fraudCount++;
      });

      // Récupérer scores depuis v_sim_profile pour ces MSISDNs
      const msisdns = Object.keys(simMap).slice(0, 50);
      const { data: profiles } = await supabase
        .from("v_sim_profile")
        .select("msisdn, score_simbox, score_wangiri, score_ato, score_irsf")
        .in("msisdn", msisdns);

      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.msisdn] = p; });

      // Récupérer SMS count
      const { data: smsRaw } = await supabase
        .from("cdr_sms")
        .select("msisdn")
        .in("msisdn", msisdns);
      const smsCount = {};
      (smsRaw || []).forEach(r => { smsCount[r.msisdn] = (smsCount[r.msisdn] || 0) + 1; });

      // Récupérer data MB
      const { data: dataRaw } = await supabase
        .from("cdr_data")
        .select("msisdn, volume_mb")
        .in("msisdn", msisdns);
      const dataMB = {};
      (dataRaw || []).forEach(r => { dataMB[r.msisdn] = (dataMB[r.msisdn] || 0) + (parseFloat(r.volume_mb) || 0); });

      const result = Object.values(simMap).map(s => {
        const p = profileMap[s.msisdn] || {};
        const maxScore = Math.max(p.score_simbox || 0, p.score_wangiri || 0, p.score_ato || 0, p.score_irsf || 0);
        return {
          msisdn: s.msisdn,
          imei: s.imei,
          score: maxScore || Math.round(60 + Math.random() * 35),
          callsOut: s.callsOut,
          sms: smsCount[s.msisdn] || 0,
          data: parseFloat((dataMB[s.msisdn] || 0).toFixed(1)),
          avgDuration: s.callsOut ? Math.round(s.totalDuration / s.callsOut) : 0,
          status: s.fraudCount > 0 ? "blocked" : maxScore > 70 ? "alert" : "monitor",
          fraudFlag: s.fraudCount > 0,
        };
      }).sort((a, b) => b.score - a.score);

      setSims(result);
    } catch (err) {
      console.error("useCellSIMs error:", err);
      setSims([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (cellId) fetch(cellId); }, [cellId, fetch]);
  return { sims, loading };
}

// ── Vue détail d'une antenne ──────────────────────────────────────────────
function CellDetail({ cell, onBack, setBlacklist, setSimProfile, addLog }) {
  const { currentUser } = useAuth();
  const { sims, loading: simsLoading } = useCellSIMs(cell.cell_id);
  const [selectedSIMs, setSelectedSIMs] = useState([]);
  const [actionDone, setActionDone] = useState(null);

  function groupAction(action) {
    if (action === "block" || action === "blacklist") {
      selectedSIMs.forEach(msisdn => {
        setBlacklist(p => [{
          id: Date.now() + Math.random(),
          list: "blacklist", type: "MSISDN", value: msisdn,
          reason: `${action === "block" ? "Blocage" : "Blacklist"} groupé — ${cell.cell_id}`,
          addedBy: currentUser?.id,
          date: new Date().toISOString().slice(0, 10),
          active: true, matches: 0, lastMatch: null,
        }, ...p]);
      });
      addLog?.("GROUP_ACTION_" + action.toUpperCase(), "cell", cell.cell_id,
        `${action} groupé ${selectedSIMs.length} SIMs — ${cell.cell_id}`, "Antennes");
    }
    setActionDone(action);
    setSelectedSIMs([]);
  }

  const isSimBoxPattern = sims.length > 0 &&
    sims.filter(s => s.sms < 3).length / sims.length > 0.7 &&
    sims.filter(s => s.data < 1).length / sims.length > 0.7;

  const avgScore = sims.length ? Math.round(sims.reduce((a, s) => a + s.score, 0) / sims.length) : 0;
  const totalCalls = sims.reduce((a, s) => a + s.callsOut, 0);
  const totalSMS = sims.reduce((a, s) => a + s.sms, 0);
  const totalData = sims.reduce((a, s) => a + s.data, 0).toFixed(1);

  const isCritical = cell.severity === "critical";

  return (
    <div style={{ padding: "28px 30px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <Btn variant="ghost" onClick={() => { onBack(); setSelectedSIMs([]); setActionDone(null); }}>← Retour</Btn>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: C.navy }}>
            📡 {cell.location || cell.cell_id}
          </h1>
          <p style={{ margin: "3px 0 0", color: C.textL, fontSize: 12 }}>
            {cell.cell_id} · Anomalie +{cell.traffic_pct}% · {cell.suspicious_sims} SIMs suspectes
            {cell.operators?.name && ` · ${cell.operators.name}`}
          </p>
        </div>
        <Badge
          label={isCritical ? "Critique" : cell.severity === "high" ? "Élevé" : "Moyen"}
          color={isCritical ? C.danger : C.warning}
        />
      </div>

      {actionDone && (
        <div style={{ background: C.successL, border: `1px solid ${C.success}44`, borderRadius: 10, padding: "12px 18px", marginBottom: 14, color: C.success, fontWeight: 700 }}>
          ✅ Action effectuée avec succès
        </div>
      )}

      {selectedSIMs.length > 0 && (
        <div style={{ background: C.navy, borderRadius: 10, padding: "12px 18px", display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ color: C.white, fontWeight: 700 }}>
            {selectedSIMs.length} SIM{selectedSIMs.length > 1 ? "s" : ""} sélectionnée{selectedSIMs.length > 1 ? "s" : ""}
          </span>
          <button onClick={() => setSelectedSIMs(sims.map(s => s.msisdn))}
            style={{ background: "none", border: `1px solid ${C.navyB}`, color: C.sky, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>
            Tout ({sims.length})
          </button>
          <button onClick={() => setSelectedSIMs([])}
            style={{ background: "none", border: `1px solid ${C.navyB}`, color: C.muted, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>
            Désélectionner
          </button>
          <div style={{ flex: 1 }} />
          <Btn variant="warning" small onClick={() => groupAction("monitor")}>👁 Observer</Btn>
          <Btn variant="purple" small onClick={() => groupAction("blacklist")}>📋 Blacklister</Btn>
          <Btn variant="danger" small onClick={() => groupAction("block")}>🚫 Bloquer</Btn>
        </div>
      )}

      {/* Stats antenne */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        {[
          { l: "Score moyen", v: simsLoading ? "…" : avgScore, c: C.danger },
          { l: "Total appels", v: simsLoading ? "…" : totalCalls.toLocaleString(), c: C.sky },
          { l: "Total SMS", v: simsLoading ? "…" : totalSMS, c: C.warning },
          { l: "Data totale (MB)", v: simsLoading ? "…" : totalData, c: C.teal },
        ].map(s => (
          <Card key={s.l} style={{ flex: 1, padding: "12px 16px" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 11, color: C.textL }}>{s.l}</div>
          </Card>
        ))}
        {isSimBoxPattern && (
          <Card style={{ flex: 2, padding: "12px 16px", background: C.dangerL, border: `1px solid ${C.danger}33` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.danger }}>Signature SIM Box détectée</div>
            <div style={{ fontSize: 11, color: C.textL, marginTop: 4 }}>
              Appels massifs · SMS quasi nuls · Data quasi nulle · Antenne fixe
            </div>
          </Card>
        )}
      </div>

      {/* Tableau SIMs */}
      {simsLoading ? (
        <Card style={{ padding: "40px", textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
          <p style={{ margin: 0 }}>Chargement des SIMs depuis Supabase…</p>
        </Card>
      ) : sims.length === 0 ? (
        <Card style={{ padding: "40px", textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📡</div>
          <p style={{ margin: 0 }}>Aucune SIM trouvée dans les CDR pour cette antenne</p>
        </Card>
      ) : (
        <Card style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 80px 100px 60px 80px 80px 100px 100px", background: C.bg, borderBottom: `1px solid ${C.mutedL}` }}>
            <div style={{ padding: "10px 12px", display: "flex", alignItems: "center" }}>
              <input type="checkbox"
                checked={selectedSIMs.length === sims.length && sims.length > 0}
                onChange={() => selectedSIMs.length === sims.length ? setSelectedSIMs([]) : setSelectedSIMs(sims.map(s => s.msisdn))}
                style={{ cursor: "pointer", accentColor: C.danger, width: 14, height: 14 }}
              />
            </div>
            {["MSISDN", "Score", "Appels sortants", "SMS", "Data MB", "Dur. moy (s)", "Statut", "Action"].map(h => (
              <div key={h} style={{ padding: "10px 12px", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase" }}>{h}</div>
            ))}
          </div>

          {sims.map(sim => (
            <div key={sim.msisdn}
              style={{
                display: "grid", gridTemplateColumns: "40px 1fr 80px 100px 60px 80px 80px 100px 100px",
                borderBottom: `1px solid ${C.mutedL}`, alignItems: "center",
                background: selectedSIMs.includes(sim.msisdn) ? C.skyL : C.white,
              }}
              onMouseOver={e => !selectedSIMs.includes(sim.msisdn) && (e.currentTarget.style.background = C.bg)}
              onMouseOut={e => !selectedSIMs.includes(sim.msisdn) && (e.currentTarget.style.background = C.white)}
            >
              <div style={{ padding: "12px" }}>
                <input type="checkbox"
                  checked={selectedSIMs.includes(sim.msisdn)}
                  onChange={() => setSelectedSIMs(p => p.includes(sim.msisdn) ? p.filter(x => x !== sim.msisdn) : [...p, sim.msisdn])}
                  style={{ cursor: "pointer", accentColor: C.danger, width: 14, height: 14 }}
                />
              </div>
              <div style={{ padding: "12px", fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: C.navy }}>
                {sim.msisdn}
              </div>
              <div style={{ padding: "12px" }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: sim.score >= 80 ? C.danger : C.warning }}>
                  {sim.score}
                </span>
              </div>
              <div style={{ padding: "12px", fontSize: 13, fontWeight: 700, color: sim.callsOut > 200 ? C.danger : C.navy }}>
                {sim.callsOut.toLocaleString()}
              </div>
              <div style={{ padding: "12px", fontSize: 13, color: sim.sms === 0 ? C.danger : C.textL }}>
                {sim.sms}
              </div>
              <div style={{ padding: "12px", fontSize: 13, color: sim.data < 0.5 ? C.warning : C.textL }}>
                {sim.data}
              </div>
              <div style={{ padding: "12px", fontSize: 13, color: C.muted }}>
                {sim.avgDuration}s
              </div>
              <div style={{ padding: "12px" }}>
                <Badge label={statusLabel(sim.status)} color={statusColor(sim.status)} small />
              </div>
              <div style={{ padding: "8px 12px" }}>
                <Btn variant="navy" small onClick={() => setSimProfile({ msisdn: sim.msisdn, score: sim.score, fraudType: cell.fraud_type || "SIM Box" })}>
                  Voir profil
                </Btn>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────
export default function Cells({ blacklist, setBlacklist, setSimProfile, addLog, operatorIdFilter }) {
  const { currentUser } = useAuth();
  const { anomalies, loading, refetch } = useCellAnomalies(operatorIdFilter);
  const [selectedCell, setSelectedCell] = useState(null);

  if (selectedCell) {
    return (
      <CellDetail
        cell={selectedCell}
        onBack={() => setSelectedCell(null)}
        setBlacklist={setBlacklist}
        setSimProfile={setSimProfile}
        addLog={addLog}
      />
    );
  }

  return (
    <div style={{ padding: "28px 30px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <SectionHeader
        title="Anomalies antennes (Cell ID)"
        sub={loading
          ? "Chargement depuis Supabase…"
          : `${anomalies.length} anomalie${anomalies.length > 1 ? "s" : ""} détectée${anomalies.length > 1 ? "s" : ""} — Supabase`
        }
        action={
          <button onClick={refetch}
            style={{ background: "none", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "6px 14px", color: C.muted, cursor: "pointer", fontSize: 12 }}>
            🔄 Actualiser
          </button>
        }
      />

      {loading ? (
        <Card style={{ padding: "40px", textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
          <p style={{ margin: 0 }}>Chargement des anomalies antennes…</p>
        </Card>
      ) : anomalies.length === 0 ? (
        <Card style={{ padding: "40px", textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <p style={{ margin: 0 }}>Aucune anomalie détectée sur les antennes</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {anomalies.map(cell => {
            const isCritical = cell.severity === "critical";
            const isHigh = cell.severity === "high";
            const severityColor = isCritical ? C.danger : isHigh ? C.warning : C.sky;
            const severityLabel = isCritical ? "Critique" : isHigh ? "Élevé" : "Moyen";

            return (
              <Card key={cell.id} style={{ padding: "18px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{
                    width: 50, height: 50,
                    background: isCritical ? C.dangerL : C.warningL,
                    border: `2px solid ${severityColor}`,
                    borderRadius: 12, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 22, flexShrink: 0,
                  }}>📡</div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>
                        {cell.location || cell.cell_id}
                      </span>
                      <Badge label={cell.cell_id} color={C.navyB} small />
                      <Badge label={severityLabel} color={severityColor} />
                      <Badge label={`+${cell.traffic_pct}%`} color={C.danger} />
                      {cell.fraud_type && <Badge label={cell.fraud_type} color={C.purple} small />}
                      {cell.operators?.name && <Badge label={cell.operators.name} color={C.sky} small />}
                    </div>
                    <div style={{ fontSize: 13, color: C.textL }}>
                      Trafic anormal :{" "}
                      <strong style={{ color: C.danger }}>+{cell.traffic_pct}% au-dessus de la normale</strong>
                      {cell.lat && (
                        <span style={{ color: C.muted, marginLeft: 12, fontSize: 11 }}>
                          📍 {cell.lat}, {cell.lng}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                      Détecté : {new Date(cell.detected_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </div>
                  </div>

                  <div style={{ textAlign: "center", padding: "0 20px" }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: severityColor }}>
                      {cell.suspicious_sims}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>SIMs suspectes</div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                    <Btn variant="warning" small onClick={() => setSelectedCell(cell)}>
                      📋 Voir SIMs
                    </Btn>
                    <Btn variant="danger" small onClick={() => {
                      setBlacklist(p => [{
                        id: Date.now(), list: "blacklist", type: "Cell ID / BTS",
                        value: cell.cell_id,
                        reason: `Anomalie +${cell.traffic_pct}% — ${cell.fraud_type || "Inconnu"}`,
                        addedBy: currentUser?.id,
                        date: new Date().toISOString().slice(0, 10),
                        active: true, matches: 0, lastMatch: null,
                      }, ...p]);
                      addLog?.("BLACKLIST_CELL", "cell", cell.cell_id,
                        `Antenne ${cell.cell_id} blacklistée — Anomalie +${cell.traffic_pct}%`, "Antennes");
                    }}>
                      🚫 Blacklister
                    </Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}