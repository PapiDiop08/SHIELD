// ── SHIELD Détections Page (ex-Alertes) — FULL LINK ─────────────────────────
// • Renommé "Détections"
// • Filtre date début + date fin (au lieu de période fixe)
// • Bouton télécharger CSV (filtré sur à bloquer)
// • Option blocage manuel si client ne veut pas auto-block

import { useState, useMemo } from "react";
import { supabase } from "../supabase.js";
import { blockAndBlacklist } from "../blockAndBlacklist.js";
import { C, sevColor, sevLabel, statusColor, statusLabel, fraudCatIcon, fraudCatColor } from "../theme.js";
import { Card, Badge, Btn, SearchInput, Select, SectionHeader, ConfirmModal, Avatar } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";

// ── Export CSV ────────────────────────────────────────────────────────────
function exportCSV(rows, filename = "detections_shield.csv") {
  const headers = ["MSISDN", "Type_Fraude", "Severite", "Score", "Statut", "Operateur", "Cell_ID", "IMEI", "IMSI", "Regle", "Date_Detection", "Assigne_A"];
  const lines = [
    headers.join(";"),
    ...rows.map(a => [
      a.msisdn || "",
      a.type || "",
      a.severity || "",
      a.score || "",
      a.status || "",
      a.operator || "",
      a.cellId || a.cell_id || "",
      a.imei || "",
      a.imsi || "",
      (a.rule || a.triggered_rule_name || "").replace(/;/g, ","),
      a.createdAt || a.detected_at || "",
      a.assignedTo || "",
    ].join(";"))
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function inDateRange(dateStr, dateFrom, dateTo) {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (dateFrom && d < new Date(dateFrom + "T00:00:00")) return false;
  if (dateTo   && d > new Date(dateTo   + "T23:59:59")) return false;
  return true;
}

export default function Detections({ alerts, setAlerts, cases, users, setSimProfile, addLog, updateAlertStatus, assignAlert: assignAlertSupabase, createBlocking, setBlockings }) {
  const { currentUser, can } = useAuth();
  const [search, setSearch]             = useState("");
  const [filterSev, setFilterSev]       = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType]     = useState("all");
  const [filterAssigned, setFilterAssigned] = useState("all");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");
  const [sortBy, setSortBy]             = useState("time");
  const [selected, setSelected]         = useState([]);
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [confirm, setConfirm]           = useState(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const safeAlerts = alerts || [];
  const analysts = (users||[]).filter(u => u.active && ["analyst", "admin", "superadmin", "gfm_analyst"].includes(u.role));
  const types = [...new Set(safeAlerts.map(a => a.type))].filter(Boolean);

  const filtered = useMemo(() => {
    let list = [...safeAlerts].filter(a => !["cleared", "closed", "false_positive"].includes(a.status));
    if (search) list = list.filter(a =>
      (a.msisdn || "").includes(search) ||
      (a.type || "").toLowerCase().includes(search.toLowerCase()) ||
      (a.operator || "").toLowerCase().includes(search.toLowerCase())
    );
    if (filterSev !== "all") list = list.filter(a => a.severity === filterSev);
    if (filterStatus !== "all") list = list.filter(a => a.status === filterStatus);
    if (filterType !== "all") list = list.filter(a => a.type === filterType);
    if (filterAssigned === "me") list = list.filter(a => a.assignedTo === currentUser?.id);
    if (filterAssigned === "unassigned") list = list.filter(a => !a.assignedTo);
    list = list.filter(a => inDateRange(a.createdAt || a.detected_at, dateFrom, dateTo));
    list.sort((a, b) =>
      sortBy === "score" ? (b.score || 0) - (a.score || 0) :
      sortBy === "severity" ? ["critical", "high", "medium", "low"].indexOf(a.severity) - ["critical", "high", "medium", "low"].indexOf(b.severity) :
      (b.createdAt || b.detected_at || "").localeCompare(a.createdAt || a.detected_at || "")
    );
    return list;
  }, [safeAlerts, search, filterSev, filterStatus, filterType, filterAssigned, dateFrom, dateTo, sortBy, currentUser]);

  // À bloquer = alertes filtrées avec score élevé non encore bloquées
  const toBlock = filtered.filter(a => a.status !== "blocked" && (a.score || 0) >= 70);

  function doAssignAlert(alertId, userId) {
    setAlerts(p => p.map(a => a.id === alertId ? { ...a, assignedTo: userId } : a));
    const u = users.find(x => x.id === userId);
    if (assignAlertSupabase) assignAlertSupabase(alertId, userId);
    addLog("ASSIGN_ALERT", "alert", alertId, `Alerte assignée à ${u?.name}`, "Détections");
  }

  function assignSelected(userId) {
    selected.forEach(id => doAssignAlert(id, userId));
    setSelected([]); setShowAssignMenu(false);
  }

  function doUpdateStatus(alertId, status) {
    setAlerts(p => p.map(a => a.id === alertId ? { ...a, status } : a));
    if (updateAlertStatus) updateAlertStatus(alertId, status);
    addLog("UPDATE_ALERT_STATUS", "alert", alertId, `Statut → ${statusLabel(status)}`, "Détections");
  }

  function doConfirmedAction() {
    if (!confirm) return;
    if (confirm.bulk) {
      selected.forEach(id => doUpdateStatus(id, confirm.status));
      setSelected([]);
    } else {
      doUpdateStatus(confirm.alertId, confirm.status);
    }
    setConfirm(null);
  }

  // Blocage manuel groupé — Bloquer + Blacklister MSISDN/IMEI/Cell
  async function blockSelected() {
    const targets = (alerts||[]).filter(a => selected.includes(a.id));
    for (const a of targets) {
      doUpdateStatus(a.id, "blocked");
      await blockAndBlacklist({
        msisdn: a.msisdn,
        imei: a.imei || null,
        imsi: a.imsi || null,
        cell_id: a.cellId || a.cell_id || null,
        operatorId: a.operatorId || null,
        reason: `Détections — ${a.type} — Score ${a.score}`,
        addLog,
      });
    }
    setSelected([]);
  }

  const allSel = filtered.length > 0 && filtered.every(a => selected.includes(a.id));
  const hasFilters = search || filterSev !== "all" || filterStatus !== "all" || filterType !== "all" || filterAssigned !== "all" || dateFrom || dateTo;

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) + " " +
           d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={{ padding: "24px 20px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <SectionHeader
        title="Détections"
        sub={<><span style={{ color: C.success }}>● Live</span> — {filtered.length} détections actives · {(alerts||[]).filter(a => a.severity === "critical").length} critiques</>}
        action={
          <div style={{ display: "flex", gap: 8, position: "relative" }}>
            {/* Bouton télécharger CSV */}
            <div style={{ position: "relative" }}>
              <Btn variant="secondary" onClick={() => setShowDownloadMenu(!showDownloadMenu)}>
                Import Télécharger CSV
              </Btn>
              {showDownloadMenu && (
                <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: C.white, border: `1px solid ${C.mutedL}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 99, minWidth: 260, overflow: "hidden" }}>
                  <div style={{ padding: "8px 14px", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", background: C.bg }}>
                    Exporter pour blocage manuel
                  </div>
                  {[
                    { label: `À bloquer (score ≥70) — ${toBlock.length}`, rows: toBlock, file: "detections_a_bloquer.csv" },
                    { label: `Toutes les détections — ${filtered.length}`, rows: filtered, file: "toutes_detections.csv" },
                    { label: `Sélection — ${selected.length}`, rows: (alerts||[]).filter(a => selected.includes(a.id)), file: "selection_detections.csv", disabled: selected.length === 0 },
                  ].map((opt, i) => (
                    <div key={i}
                      onClick={() => { if (!opt.disabled && opt.rows.length > 0) { exportCSV(opt.rows, opt.file); setShowDownloadMenu(false); } }}
                      style={{ padding: "12px 16px", cursor: opt.disabled || opt.rows.length === 0 ? "not-allowed" : "pointer", opacity: opt.disabled || opt.rows.length === 0 ? 0.4 : 1, borderBottom: `1px solid ${C.mutedL}`, fontSize: 13, color: C.navy, fontWeight: 600 }}
                      onMouseOver={e => { if (!opt.disabled) e.currentTarget.style.background = C.bg; }}
                      onMouseOut={e => e.currentTarget.style.background = C.white}>
                      {opt.label}
                    </div>
                  ))}
                  <div style={{ padding: "10px 16px", fontSize: 11, color: C.muted, background: C.bg }}>
                    CSV avec MSISDN, type, score, opérateur — prêt pour blocage côté opérateur
                  </div>
                </div>
              )}
            </div>
          </div>
        }
      />

      {/* Stats rapides */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { l: "Critique", f: "critical", c: C.danger },
          { l: "Élevé", f: "high", c: C.warning },
          { l: "Moyen", f: "medium", c: C.sky },
          { l: "Mes détections", f: "me", c: C.purple },
        ].map(s => (
          <Card key={s.l}
            style={{ flex: 1, minWidth: 100, padding: "10px 14px", cursor: "pointer", borderTop: `3px solid ${s.c}` }}
            onClick={() => s.f === "me" ? setFilterAssigned(filterAssigned === "me" ? "all" : "me") : setFilterSev(filterSev === s.f ? "all" : s.f)}>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.c }}>
              {s.f === "me"
                ? (alerts||[]).filter(a => a.assignedTo === currentUser?.id && !["cleared", "closed"].includes(a.status)).length
                : (alerts||[]).filter(a => a.severity === s.f).length}
            </div>
            <div style={{ fontSize: 11, color: C.textL }}>{s.l}</div>
          </Card>
        ))}
        <Card style={{ flex: 1, minWidth: 100, padding: "10px 14px", borderTop: `3px solid ${C.danger}` }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.danger }}>{toBlock.length}</div>
          <div style={{ fontSize: 11, color: C.textL }}>À bloquer (score ≥70)</div>
        </Card>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <SearchInput value={search} onChange={setSearch} placeholder="MSISDN, type, opérateur..." />

        {/* Filtre date début/fin */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.white, border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "4px 10px" }}>
          <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>Du</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ border: "none", outline: "none", fontSize: 12, color: C.navy, background: "transparent", cursor: "pointer" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.white, border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "4px 10px" }}>
          <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>Au</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ border: "none", outline: "none", fontSize: 12, color: C.navy, background: "transparent", cursor: "pointer" }} />
        </div>

        <Select value={filterSev} onChange={setFilterSev} options={[{ value: "all", label: "Sévérité" }, { value: "critical", label: "Critique" }, { value: "high", label: "Élevé" }, { value: "medium", label: "Moyen" }]} />
        <Select value={filterStatus} onChange={setFilterStatus} options={[{ value: "all", label: "Statut" }, { value: "alert", label: "Alerte" }, { value: "monitor", label: "Surveillance" }, { value: "investigating", label: "En cours" }, { value: "blocked", label: "Bloqué" }]} />
        <Select value={filterType} onChange={setFilterType} options={[{ value: "all", label: "Type" }, ...types.map(t => ({ value: t, label: `${fraudCatIcon(t)} ${t}` }))]} />
        <Select value={filterAssigned} onChange={setFilterAssigned} options={[{ value: "all", label: "Assignation" }, { value: "me", label: "Mes détections" }, { value: "unassigned", label: "Non assignées" }]} />
        <Select value={sortBy} onChange={setSortBy} options={[{ value: "time", label: "Récentes" }, { value: "score", label: "Score ↓" }, { value: "severity", label: "Sévérité" }]} />
        {hasFilters && (
          <button onClick={() => { setSearch(""); setFilterSev("all"); setFilterStatus("all"); setFilterType("all"); setFilterAssigned("all"); setDateFrom(""); setDateTo(""); }}
            style={{ background: "none", border: "none", color: C.red, fontSize: 12, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
            X Effacer
          </button>
        )}
      </div>

      {/* Barre actions groupées */}
      {selected.length > 0 && (
        <div style={{ background: C.navy, borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ color: C.white, fontWeight: 700, fontSize: 12 }}>
            {selected.length} sélectionnée{selected.length > 1 ? "s" : ""}
          </span>
          <button onClick={() => setSelected([])}
            style={{ background: "none", border: `1px solid ${C.navyB}`, color: C.muted, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>
            Désélectionner
          </button>
          <div style={{ flex: 1 }} />

          {/* Assigner */}
          <div style={{ position: "relative" }}>
            <Btn variant="sky" small onClick={() => setShowAssignMenu(!showAssignMenu)}>USR Assigner</Btn>
            {showAssignMenu && (
              <div style={{ position: "absolute", top: "100%", right: 0, background: C.white, border: `1px solid ${C.mutedL}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 99, minWidth: 200, marginTop: 4, maxHeight: 240, overflowY: "auto" }}>
                {analysts.map(u => (
                  <div key={u.id} onClick={() => assignSelected(u.id)}
                    style={{ padding: "9px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}
                    onMouseOver={e => e.currentTarget.style.background = C.bg}
                    onMouseOut={e => e.currentTarget.style.background = C.white}>
                    <Avatar user={u} size={22} />{u.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Btn variant="warning" small onClick={() => { selected.forEach(id => doUpdateStatus(id, "investigating")); setSelected([]); }}>
            Rch En cours
          </Btn>

          {/* Bloquer manuellement — option pour clients sans auto-block */}
          <Btn variant="danger" small onClick={() => setConfirm({ bulk: true, status: "blocked", msg: `Bloquer manuellement ${selected.length} détection(s) ?` })}>
            [X] Bloquer ({selected.length})
          </Btn>

          <Btn variant="success" small onClick={() => setConfirm({ alertId: null, status: "cleared", bulk: true, msg: `Clôturer ${selected.length} détections ?` })}>
            v Clôturer
          </Btn>

          {/* Export sélection */}
          <Btn variant="ghost" small onClick={() => exportCSV((alerts||[]).filter(a => selected.includes(a.id)), "selection_detections.csv")}>
            Import CSV
          </Btn>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: C.textL }}>
          {filtered.length} détection{filtered.length > 1 ? "s" : ""}
          {toBlock.length > 0 && <span style={{ color: C.danger, fontWeight: 700, marginLeft: 12 }}>! {toBlock.length} à bloquer</span>}
        </div>
        {toBlock.length > 0 && (
          <button onClick={() => exportCSV(toBlock, "detections_a_bloquer.csv")}
            style={{ background: C.dangerL, border: `1px solid ${C.danger}44`, color: C.danger, borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            Import Exporter les {toBlock.length} à bloquer
          </button>
        )}
      </div>

      {/* Table */}
      <Card style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 750 }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `2px solid ${C.mutedL}` }}>
                <th style={{ padding: "10px 10px", width: 36 }}>
                  <input type="checkbox" checked={allSel} onChange={() => allSel ? setSelected([]) : setSelected(filtered.map(a => a.id))}
                    style={{ cursor: "pointer", accentColor: C.red }} />
                </th>
                {["", "Date · Heure", "MSISDN", "Type · Opérateur", "Règle déclenchée", "Score", "Statut", "Assigné", "Actions"].map(h => (
                  <th key={h} style={{ padding: "10px 10px", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: "40px", textAlign: "center", color: C.muted }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>Rch</div>Aucune détection
                </td></tr>
              )}
              {filtered.map(a => {
                const assignedUser = (users||[]).find(u => u.id === a.assignedTo);
                const isSel = selected.includes(a.id);
                const dateDisplay = formatDate(a.createdAt || a.detected_at);
                return (
                  <tr key={a.id}
                    style={{ borderBottom: `1px solid ${C.mutedL}`, background: isSel ? C.skyL : C.white }}
                    onMouseOver={e => !isSel && (e.currentTarget.style.background = C.bg)}
                    onMouseOut={e => !isSel && (e.currentTarget.style.background = C.white)}>
                    <td style={{ padding: "10px" }}>
                      <input type="checkbox" checked={isSel}
                        onChange={() => setSelected(p => p.includes(a.id) ? p.filter(x => x !== a.id) : [...p, a.id])}
                        style={{ cursor: "pointer", accentColor: C.red }} />
                    </td>
                    <td style={{ padding: "2px 0", width: 4 }}>
                      <div style={{ width: 4, background: sevColor(a.severity), height: 52 }} />
                    </td>
                    <td style={{ padding: "10px" }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.navy }}>{dateDisplay}</div>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, fontFamily: "monospace" }}>{a.msisdn}</div>
                    </td>
                    <td style={{ padding: "10px", cursor: "pointer" }} onClick={() => setSimProfile({ msisdn: a.msisdn, score: a.score, fraudType: a.type })}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.navy, whiteSpace: "nowrap" }}>{fraudCatIcon(a.type)} {a.type}</div>
                      <div style={{ fontSize: 11, color: C.textL, whiteSpace: "nowrap" }}>{a.operator}</div>
                    </td>
                    <td style={{ padding: "10px", maxWidth: 200 }}>
                      {(a.triggeredRules && a.triggeredRules.length > 0)
                        ? <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                            {a.triggeredRules.slice(0,2).map((r,i) => (
                              <span key={i} style={{ background: "#eef2ff", color: "#3730a3", borderRadius: 4, padding: "2px 6px", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }} title={r}>{r}</span>
                            ))}
                            {a.triggeredRules.length > 2 && <span style={{ fontSize: 10, color: C.muted }}>+{a.triggeredRules.length-2}</span>}
                          </div>
                        : <span style={{ fontSize: 11, color: C.muted }}>{a.rule || a.reason || "—"}</span>}
                    </td>
                    <td style={{ padding: "10px", textAlign: "center" }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: (a.score || 0) >= 80 ? C.danger : (a.score || 0) >= 60 ? C.warning : C.sky }}>
                        {a.score || a.risk_score || "—"}
                      </div>
                    </td>
                    <td style={{ padding: "10px" }}>
                      <Badge label={statusLabel(a.status)} color={statusColor(a.status)} small />
                    </td>
                    <td style={{ padding: "10px" }}>
                      {assignedUser
                        ? <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Avatar user={assignedUser} size={20} />
                            <span style={{ fontSize: 11, color: C.textL, whiteSpace: "nowrap" }}>{assignedUser.name.split(" ")[0]}</span>
                          </div>
                        : <select onChange={e => { if (e.target.value) doAssignAlert(a.id, e.target.value); }}
                            style={{ border: `1px solid ${C.mutedL}`, borderRadius: 6, padding: "3px 6px", fontSize: 11, color: C.muted, background: C.white, cursor: "pointer", maxWidth: 110 }}>
                            <option value="">Assigner...</option>
                            {analysts.map(u => <option key={u.id} value={u.id}>{u.name.split(" ")[0]}</option>)}
                          </select>}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <Btn variant="navy" small onClick={() => setSimProfile({ msisdn: a.msisdn, score: a.score || a.risk_score, fraudType: a.type })}>
                          Voir
                        </Btn>
                        <select value={a.status}
                          onChange={e => setConfirm({ alertId: a.id, status: e.target.value, bulk: false, msg: `Confirmer : ${statusLabel(e.target.value)} pour ${a.msisdn} ?` })}
                          style={{ border: `1px solid ${C.mutedL}`, borderRadius: 6, padding: "3px 5px", fontSize: 10, color: C.navy, background: C.white, cursor: "pointer", maxWidth: 90 }}>
                          {["alert", "monitor", "investigating", "blocked", "cleared", "false_positive"].map(s =>
                            <option key={s} value={s}>{statusLabel(s)}</option>
                          )}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {confirm && (
        <ConfirmModal
          title="Confirmation"
          message={confirm.msg}
          confirmLabel="Confirmer"
          confirmColor={confirm.status === "false_positive" || confirm.status === "cleared" ? C.success : C.danger}
          onConfirm={doConfirmedAction}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}