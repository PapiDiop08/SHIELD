// ── SHIELD SimProfile Page ───────────────────────────────────────────────────
import { useState } from "react";
import { C, statusColor, statusLabel, fraudCatIcon, fraudCatColor } from "../theme.js";
import { Card, Badge, Btn, Avatar } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";

export default function SimProfile({ msisdn, score, fraudType, onBack, setBlacklist, blacklist, alerts, cases, users, addLog }) {
  const { currentUser } = useAuth();
  const [decision, setDecision] = useState(null);
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState([]);
  const [assignTo, setAssignTo] = useState("");
  const [actionLog, setActionLog] = useState([
    { ts: "08:34:12", user: "SHIELD Auto", action: "Détection automatique", detail: `Score ${score} — Règle SIM Box déclenchée` },
    { ts: "08:35:01", user: currentUser?.name || "Admin", action: "Profil consulté", detail: "Ouverture du profil SIM" },
  ]);

  const sim = {
    msisdn, imsi: "60801XXXXXXXXX", imei: "354921XXXXXXXX", imeiPrefix: "354921",
    cellId: "BTS-DKR-042", operator: "Orange Sénégal", firstSeen: "2026-03-12",
    lastSeen: "2026-06-06 08:34", simAge: 84,
    stats: {
      callsOut7d: Math.floor(score * 34), callsIn7d: Math.floor(score * 0.1),
      sms7d: 2, dataMB7d: "0.1", callsOut30d: Math.floor(score * 150),
      uniqueDest7d: Math.floor(score * 30), fixedCalls7d: 187, avgDuration: "6.2",
      topCountries: [{ c: "AE — Emirats", n: 1240 }, { c: "MA — Maroc", n: 890 }, { c: "SN local", n: 678 }],
      similarPct: (score * 0.003).toFixed(1),
      similarCount: Math.floor(score * 8.4),
    },
    cells: [{ cell: "BTS-DKR-042", pct: 98, days: 82 }, { cell: "BTS-DKR-018", pct: 2, days: 2 }],
    history: [
      { date: "08:34", type: "Appel sortant", dest: "+97150XXXXXXX", dur: "8s", cell: "BTS-DKR-042" },
      { date: "08:33", type: "Appel sortant", dest: "+97150XXXXXXX", dur: "6s", cell: "BTS-DKR-042" },
      { date: "08:32", type: "Appel sortant", dest: "+21260XXXXXXX", dur: "5s", cell: "BTS-DKR-042" },
      { date: "08:31", type: "Appel entrant", dest: "+33612XXXXXX", dur: "0s (manqué)", cell: "BTS-DKR-042" },
      { date: "08:30", type: "Appel sortant", dest: "+97155XXXXXXX", dur: "7s", cell: "BTS-DKR-042" },
    ],
  };

  const analysts = users?.filter(u => u.active && ["analyst","admin","superadmin"].includes(u.role)) || [];
  const relatedAlerts = alerts?.filter(a => a.msisdn === msisdn) || [];
  const relatedCases = cases?.filter(c => relatedAlerts.some(a => a.caseId === c.id)) || [];

  function doAction(action) {
    setDecision(action);
    const detail = { blocked: `SIM bloquée — ${fraudType}`, blacklist: `Blacklistée — ${fraudType}`, monitor: "Mise sous observation", fp: "Marquée faux positif", ignore: "Ignorée" }[action];
    setActionLog(p => [{ ts: new Date().toTimeString().slice(0, 8), user: currentUser?.name, action: detail, detail: `Par ${currentUser?.name}` }, ...p]);
    if (action === "blocked" || action === "blacklist") {
      setBlacklist(p => [{ id: Date.now(), list: "blacklist", type: "MSISDN", value: msisdn, reason: `${action === "blocked" ? "Blocage" : "Blacklist"} — ${fraudType}`, addedBy: currentUser?.id, date: new Date().toISOString().slice(0, 10), active: true, matches: 0, lastMatch: null }, ...p]);
    }
    addLog?.("SIM_ACTION_" + action.toUpperCase(), "sim", msisdn, detail, "SimProfile");
  }

  function addNote() {
    if (!note.trim()) return;
    const n = { id: Date.now(), ts: new Date().toTimeString().slice(0, 8), user: currentUser?.name, text: note };
    setNotes(p => [n, ...p]);
    setActionLog(p => [{ ts: n.ts, user: currentUser?.name, action: "Note ajoutée", detail: note.slice(0, 60) }, ...p]);
    setNote("");
    addLog?.("ADD_NOTE", "sim", msisdn, `Note : ${note.slice(0, 60)}`, "SimProfile");
  }

  function doAssign() {
    if (!assignTo) return;
    const u = users?.find(x => x.id === assignTo);
    setActionLog(p => [{ ts: new Date().toTimeString().slice(0, 8), user: currentUser?.name, action: "Assigné", detail: `Assigné à ${u?.name}` }, ...p]);
    addLog?.("ASSIGN_SIM", "sim", msisdn, `SIM assignée à ${u?.name}`, "SimProfile");
    setAssignTo("");
  }

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: C.bg, minHeight: "100vh", padding: "24px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <Btn variant="ghost" onClick={onBack}>← Retour</Btn>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: C.navy, fontFamily: "monospace" }}>{msisdn}</h1>
            {fraudType && <Badge label={`${fraudCatIcon(fraudType)} ${fraudType}`} color={fraudCatColor(fraudType)} />}
          </div>
          <p style={{ margin: 0, color: C.textL, fontSize: 12 }}>{sim.operator} · Cell {sim.cellId} · Vu pour la 1ère fois le {sim.firstSeen}</p>
        </div>
        <div style={{ background: score >= 80 ? C.dangerL : C.warningL, border: `3px solid ${score >= 80 ? C.danger : C.warning}`, borderRadius: 14, padding: "10px 18px", textAlign: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: score >= 80 ? C.danger : C.warning, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 9, color: C.textL, fontWeight: 700, textTransform: "uppercase" }}>Score SHIELD</div>
        </div>
      </div>

      {/* Action bar */}
      {!decision ? (
        <div style={{ background: C.white, border: `1px solid ${C.mutedL}`, borderRadius: 10, padding: "12px 18px", marginBottom: 18, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, color: C.navy, fontSize: 13 }}>Action :</span>
          <Btn variant="danger" small onClick={() => doAction("blocked")}>🚫 Bloquer</Btn>
          <Btn variant="purple" small onClick={() => doAction("blacklist")}>📋 Blacklister</Btn>
          <Btn variant="warning" small onClick={() => doAction("monitor")}>👁 Observer</Btn>
          <Btn variant="success" small onClick={() => doAction("fp")}>✅ Faux positif</Btn>
          <Btn variant="ghost" small onClick={() => doAction("ignore")}>Ignorer</Btn>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <select value={assignTo} onChange={e => setAssignTo(e.target.value)} style={{ border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "6px 10px", fontSize: 12, color: C.navy, background: C.white, outline: "none" }}>
              <option value="">Assigner à un analyste...</option>
              {analysts.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            {assignTo && <Btn variant="sky" small onClick={doAssign}>Assigner</Btn>}
          </div>
        </div>
      ) : (
        <div style={{ background: decision === "blocked" || decision === "blacklist" ? C.dangerL : decision === "fp" ? C.successL : C.warningL, border: `1px solid ${decision === "blocked" || decision === "blacklist" ? C.danger : decision === "fp" ? C.success : C.warning}44`, borderRadius: 10, padding: "12px 20px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, color: decision === "blocked" || decision === "blacklist" ? C.danger : decision === "fp" ? C.success : C.warning }}>
            ✓ Action enregistrée — {decision === "blocked" ? "SIM bloquée" : decision === "blacklist" ? "Blacklistée" : decision === "fp" ? "Faux positif" : decision === "monitor" ? "Sous observation" : "Ignorée"}
          </span>
          <Btn variant="ghost" small onClick={() => setDecision(null)}>Modifier</Btn>
        </div>
      )}

      <div style={{ display: "flex", gap: 18 }}>
        {/* Left */}
        <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Identity */}
          <Card style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Identité</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["MSISDN", sim.msisdn], ["IMSI", sim.imsi], ["IMEI complet", sim.imei], ["IMEI Préfixe (6)", sim.imeiPrefix], ["Cell ID actuelle", sim.cellId], ["Opérateur", sim.operator], ["Ancienneté SIM", `${sim.simAge} jours`], ["Dernière activité", sim.lastSeen]].map(([k, v]) => (
                <div key={k} style={{ background: C.bg, borderRadius: 8, padding: "8px 12px" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 2 }}>{k}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, fontFamily: ["MSISDN","IMSI","IMEI","Cell"].some(x => k.startsWith(x)) ? "monospace" : "inherit" }}>{v}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Activity */}
          <Card style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Activité</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", border: `1px solid ${C.mutedL}`, borderRadius: 8, overflow: "hidden" }}>
              {[["", "7 jours", "30 jours"], ["Appels sortants", sim.stats.callsOut7d, sim.stats.callsOut30d], ["Appels entrants", sim.stats.callsIn7d, "—"], ["SMS", sim.stats.sms7d, "—"], ["Data (MB)", sim.stats.dataMB7d, "—"], ["Appels vers fixes", sim.stats.fixedCalls7d, "—"], ["Destinations uniques", sim.stats.uniqueDest7d, "—"], ["Durée moy. (sec)", sim.stats.avgDuration, "—"]].map(([l, v7, v30], i) => [
                <div key={`l${i}`} style={{ padding: "8px 12px", background: i === 0 ? C.navy : i % 2 ? C.bg : C.white, fontSize: i === 0 ? 10 : 12, fontWeight: i === 0 ? 700 : 600, color: i === 0 ? C.white : C.navy, borderBottom: `1px solid ${C.mutedL}` }}>{l}</div>,
                <div key={`7${i}`} style={{ padding: "8px 12px", background: i === 0 ? C.navyL : i % 2 ? C.bg : C.white, fontSize: i === 0 ? 10 : 13, fontWeight: 700, color: i === 0 ? C.sky : (typeof v7 === "number" && v7 > 500 ? C.danger : C.navy), borderBottom: `1px solid ${C.mutedL}`, textAlign: "center" }}>{v7}</div>,
                <div key={`30${i}`} style={{ padding: "8px 12px", background: i === 0 ? C.navyL : i % 2 ? C.bg : C.white, fontSize: i === 0 ? 10 : 12, color: i === 0 ? C.sky : C.textL, borderBottom: `1px solid ${C.mutedL}`, textAlign: "center" }}>{v30}</div>,
              ])}
            </div>
          </Card>

          {/* History */}
          <Card style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Historique CDR récent</div>
            {sim.history.map((h, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.mutedL}`, alignItems: "center" }}>
                <div style={{ fontSize: 11, color: C.muted, width: 42 }}>{h.date}</div>
                <Badge label={h.type} color={h.type.includes("sortant") ? C.danger : C.sky} small />
                <div style={{ flex: 1, fontFamily: "monospace", fontSize: 11, color: C.navy }}>{h.dest}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{h.dur}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{h.cell}</div>
              </div>
            ))}
          </Card>

          {/* Notes */}
          <Card style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Notes analystes</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && addNote()} placeholder="Ajouter une note..." style={{ flex: 1, border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: C.navy, outline: "none" }} />
              <Btn variant="navy" small onClick={addNote}>Ajouter</Btn>
            </div>
            {notes.length === 0 ? <p style={{ margin: 0, color: C.muted, fontSize: 12, fontStyle: "italic" }}>Aucune note</p> : notes.map(n => (
              <div key={n.id} style={{ background: C.bg, borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>{n.user}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>{n.ts}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: C.text }}>{n.text}</p>
              </div>
            ))}
          </Card>

          {/* Action history */}
          <Card style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Historique des actions</div>
            {actionLog.map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.mutedL}`, alignItems: "flex-start" }}>
                <div style={{ fontSize: 10, color: C.muted, width: 50, flexShrink: 0 }}>{l.ts}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{l.action}</div>
                  <div style={{ fontSize: 11, color: C.textL }}>{l.detail}</div>
                </div>
                <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>{l.user}</div>
              </div>
            ))}
          </Card>
        </div>

        {/* Right */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Behavior */}
          <Card style={{ padding: "16px 20px", background: C.dangerL, border: `1px solid ${C.danger}33` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.danger, marginBottom: 6 }}>Comportement similaire</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: C.danger }}>{sim.stats.similarPct}%</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.danger }}>≈ {sim.stats.similarCount.toLocaleString()} SIMs</div>
            <div style={{ fontSize: 11, color: C.textL, marginTop: 4 }}>de la base présentent un pattern similaire</div>
          </Card>

          {/* Top countries */}
          <Card style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Top destinations</div>
            {sim.stats.topCountries.map(c => (
              <div key={c.c} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>{c.c}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 60, height: 5, background: C.mutedL, borderRadius: 3 }}><div style={{ height: "100%", width: `${Math.min(c.n / 15, 100)}%`, background: C.red, borderRadius: 3 }} /></div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.textL, width: 35, textAlign: "right" }}>{c.n}</span>
                </div>
              </div>
            ))}
          </Card>

          {/* Cell movements */}
          <Card style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Déplacements (Cell IDs)</div>
            {sim.cells.map(c => (
              <div key={c.cell} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: C.navy, fontWeight: 600 }}>{c.cell}</span>
                  <span style={{ fontSize: 11, color: C.textL }}>{c.pct}% · {c.days}j</span>
                </div>
                <div style={{ height: 6, background: C.mutedL, borderRadius: 3 }}><div style={{ height: "100%", width: `${c.pct}%`, background: c.pct > 90 ? C.danger : C.sky, borderRadius: 3 }} /></div>
              </div>
            ))}
            {sim.cells.length === 1 || sim.cells[0].pct > 95 ? <p style={{ margin: "6px 0 0", fontSize: 11, color: C.danger, fontStyle: "italic" }}>⚠ SIM fixe — comportement SIM Box probable</p> : null}
          </Card>

          {/* Related cases */}
          {relatedCases.length > 0 && (
            <Card style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>Cases liés</div>
              {relatedCases.map(c => (
                <div key={c.id} style={{ padding: "8px 0", borderBottom: `1px solid ${C.mutedL}` }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{c.type} · {c.status}</div>
                </div>
              ))}
            </Card>
          )}

          {/* Related alerts */}
          {relatedAlerts.length > 0 && (
            <Card style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 10 }}>Alertes liées ({relatedAlerts.length})</div>
              {relatedAlerts.slice(0, 5).map(a => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.mutedL}` }}>
                  <div><div style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>{a.type}</div><div style={{ fontSize: 10, color: C.muted }}>{a.time}</div></div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: a.score >= 80 ? C.danger : C.warning }}>{a.score}</div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}