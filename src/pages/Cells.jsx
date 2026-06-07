// ── SHIELD Cells Page ───────────────────────────────────────────────────

import { useState } from "react";
import { C, statusColor, statusLabel } from "../theme.js";
import { Card, Badge, Btn, SectionHeader } from "../components.jsx";
import { CELL_ANOMALIES } from "../mockData.js";
import { useAuth } from "../AuthContext.jsx";

export default function Cells({ blacklist, setBlacklist, setSimProfile, addLog }) {
  const { currentUser } = useAuth();
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedSIMs, setSelectedSIMs] = useState([]);
  const [actionDone, setActionDone] = useState(null);

  function groupAction(action, cell) {
    if (action === "block" || action === "blacklist") {
      selectedSIMs.forEach(msisdn => {
        setBlacklist(p => [{ id: Date.now() + Math.random(), list: "blacklist", type: "MSISDN", value: msisdn, reason: `${action === "block" ? "Blocage" : "Blacklist"} groupé — ${cell.id}`, addedBy: currentUser?.id, date: new Date().toISOString().slice(0, 10), active: true, matches: 0, lastMatch: null }, ...p]);
      });
      addLog?.("GROUP_ACTION_" + action.toUpperCase(), "cell", cell.id, `${action} groupé ${selectedSIMs.length} SIMs — ${cell.id}`, "Antennes");
    }
    setActionDone(action); setSelectedSIMs([]);
  }

  if (selectedCell) {
    const cell = CELL_ANOMALIES.find(c => c.id === selectedCell);
    return (
      <div style={{ padding: "28px 30px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <Btn variant="ghost" onClick={() => { setSelectedCell(null); setSelectedSIMs([]); setActionDone(null); }}>← Retour</Btn>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: C.navy }}>📡 {cell.name}</h1>
            <p style={{ margin: "3px 0 0", color: C.textL, fontSize: 12 }}>{cell.id} · Anomalie {cell.delta} · {cell.sims.length} SIMs suspectes</p>
          </div>
          <Badge label={cell.status === "critical" ? "Critique" : "Élevé"} color={cell.status === "critical" ? C.danger : C.warning} />
        </div>

        {actionDone && <div style={{ background: C.successL, border: `1px solid ${C.success}44`, borderRadius: 10, padding: "12px 18px", marginBottom: 14, color: C.success, fontWeight: 700 }}>✅ Action effectuée</div>}

        {selectedSIMs.length > 0 && (
          <div style={{ background: C.navy, borderRadius: 10, padding: "12px 18px", display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ color: C.white, fontWeight: 700 }}>{selectedSIMs.length} SIM{selectedSIMs.length > 1 ? "s" : ""} sélectionnée{selectedSIMs.length > 1 ? "s" : ""}</span>
            <button onClick={() => setSelectedSIMs(cell.sims.map(s => s.msisdn))} style={{ background: "none", border: `1px solid ${C.navyB}`, color: C.sky, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>Tout ({cell.sims.length})</button>
            <button onClick={() => setSelectedSIMs([])} style={{ background: "none", border: `1px solid ${C.navyB}`, color: C.muted, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 11 }}>Désélectionner</button>
            <div style={{ flex: 1 }} />
            <Btn variant="warning" small onClick={() => groupAction("monitor", cell)}>👁 Observer</Btn>
            <Btn variant="purple" small onClick={() => groupAction("blacklist", cell)}>📋 Blacklister</Btn>
            <Btn variant="danger" small onClick={() => groupAction("block", cell)}>🚫 Bloquer</Btn>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {[{ l: "Score moyen", v: Math.round(cell.sims.reduce((a, s) => a + s.score, 0) / cell.sims.length), c: C.danger }, { l: "Total appels", v: cell.sims.reduce((a, s) => a + s.callsOut, 0).toLocaleString(), c: C.sky }, { l: "Total SMS", v: cell.sims.reduce((a, s) => a + s.sms, 0), c: C.warning }, { l: "Data totale (MB)", v: cell.sims.reduce((a, s) => a + s.data, 0).toFixed(1), c: C.teal }].map(s => (
            <Card key={s.l} style={{ flex: 1, padding: "12px 16px" }}><div style={{ fontSize: 20, fontWeight: 900, color: s.c }}>{s.v}</div><div style={{ fontSize: 11, color: C.textL }}>{s.l}</div></Card>
          ))}
          <Card style={{ flex: 2, padding: "12px 16px", background: C.dangerL, border: `1px solid ${C.danger}33` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.danger }}>Signature SIM Box détectée</div>
            <div style={{ fontSize: 11, color: C.textL, marginTop: 4 }}>Appels massifs · SMS quasi nuls · Data quasi nulle · Antenne fixe</div>
          </Card>
        </div>

        <Card style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 80px 100px 60px 80px 100px 100px", background: C.bg, borderBottom: `1px solid ${C.mutedL}` }}>
            <div style={{ padding: "10px 12px", display: "flex", alignItems: "center" }}>
              <input type="checkbox" checked={selectedSIMs.length === cell.sims.length} onChange={() => selectedSIMs.length === cell.sims.length ? setSelectedSIMs([]) : setSelectedSIMs(cell.sims.map(s => s.msisdn))} style={{ cursor: "pointer", accentColor: C.red, width: 14, height: 14 }} />
            </div>
            {["MSISDN", "Score", "Appels sortants", "SMS", "Data MB", "Statut", "Action"].map(h => (
              <div key={h} style={{ padding: "10px 12px", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase" }}>{h}</div>
            ))}
          </div>
          {cell.sims.map(sim => (
            <div key={sim.msisdn} style={{ display: "grid", gridTemplateColumns: "40px 1fr 80px 100px 60px 80px 100px 100px", borderBottom: `1px solid ${C.mutedL}`, alignItems: "center", background: selectedSIMs.includes(sim.msisdn) ? C.skyL : C.white }}
              onMouseOver={e => !selectedSIMs.includes(sim.msisdn) && (e.currentTarget.style.background = C.bg)}
              onMouseOut={e => !selectedSIMs.includes(sim.msisdn) && (e.currentTarget.style.background = C.white)}>
              <div style={{ padding: "12px" }}><input type="checkbox" checked={selectedSIMs.includes(sim.msisdn)} onChange={() => setSelectedSIMs(p => p.includes(sim.msisdn) ? p.filter(x => x !== sim.msisdn) : [...p, sim.msisdn])} style={{ cursor: "pointer", accentColor: C.red, width: 14, height: 14 }} /></div>
              <div style={{ padding: "12px", fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: C.navy }}>{sim.msisdn}</div>
              <div style={{ padding: "12px" }}><span style={{ fontSize: 16, fontWeight: 900, color: sim.score >= 80 ? C.danger : C.warning }}>{sim.score}</span></div>
              <div style={{ padding: "12px", fontSize: 13, fontWeight: 700, color: sim.callsOut > 2000 ? C.danger : C.navy }}>{sim.callsOut.toLocaleString()}</div>
              <div style={{ padding: "12px", fontSize: 13, color: sim.sms === 0 ? C.danger : C.textL }}>{sim.sms}</div>
              <div style={{ padding: "12px", fontSize: 13, color: sim.data < 0.5 ? C.warning : C.textL }}>{sim.data}</div>
              <div style={{ padding: "12px" }}><Badge label={statusLabel(sim.status)} color={statusColor(sim.status)} small /></div>
              <div style={{ padding: "8px 12px" }}><Btn variant="navy" small onClick={() => setSimProfile({ msisdn: sim.msisdn, score: sim.score, fraudType: "SIM Box" })}>Voir profil</Btn></div>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 30px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <SectionHeader title="Anomalies antennes (Cell ID)" sub="Trafic anormalement élevé vs période précédente" />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {CELL_ANOMALIES.map(cell => (
          <Card key={cell.id} style={{ padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 50, height: 50, background: cell.status === "critical" ? C.dangerL : C.warningL, border: `2px solid ${cell.status === "critical" ? C.danger : C.warning}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📡</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>{cell.name}</span>
                  <Badge label={cell.id} color={C.navyB} small />
                  <Badge label={cell.status === "critical" ? "Critique" : "Élevé"} color={cell.status === "critical" ? C.danger : C.warning} />
                  <Badge label={cell.delta} color={C.danger} />
                </div>
                <div style={{ fontSize: 13, color: C.textL }}>
                  Trafic précédent : <strong>{cell.prev}</strong> → Trafic actuel : <strong style={{ color: C.danger }}>{cell.curr}</strong>
                </div>
              </div>
              <div style={{ textAlign: "center", padding: "0 20px" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: C.danger }}>{cell.sims.length}</div>
                <div style={{ fontSize: 11, color: C.muted }}>SIMs suspectes</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                <Btn variant="warning" small onClick={() => setSelectedCell(cell.id)}>📋 Voir SIMs</Btn>
                <Btn variant="danger" small onClick={() => { setBlacklist(p => [{ id: Date.now(), list: "blacklist", type: "Cell ID / BTS", value: cell.id, reason: `Anomalie ${cell.delta}`, addedBy: currentUser?.id, date: new Date().toISOString().slice(0, 10), active: true, matches: 0, lastMatch: null }, ...p]); addLog?.("BLACKLIST_CELL", "cell", cell.id, `Antenne ${cell.id} blacklistée — Anomalie ${cell.delta}`, "Antennes"); }}>🚫 Blacklister antenne</Btn>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}