// ── SHIELD Cases Page ───────────────────────────────────────────────────

import { useState, useMemo } from "react";
import { C, sevColor, fraudCatIcon, fraudCatColor, FRAUD_CATEGORIES, ALL_FRAUD_TYPES } from "../theme.js";
import { Card, Badge, Btn, SearchInput, Select, SectionHeader, Modal, Avatar } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";

export default function Cases({ cases, setCases, alerts, users, setSimProfile, addLog, navigate }) {
  const { currentUser, can } = useAuth();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [newCase, setNewCase] = useState({ name: "", description: "", type: ALL_FRAUD_TYPES[0], priority: "high", assignedTo: [] });

  const analysts = users.filter(u => u.active && ["analyst","admin","superadmin"].includes(u.role));

  const filtered = useMemo(() => {
    let list = [...cases];
    if (search) list = list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase()));
    if (filterStatus !== "all") list = list.filter(c => c.status === filterStatus);
    if (filterPriority !== "all") list = list.filter(c => c.priority === filterPriority);
    if (filterType !== "all") list = list.filter(c => c.type === filterType);
    return list;
  }, [cases, search, filterStatus, filterPriority, filterType]);

  function createCase() {
    const c = { id: `case${Date.now()}`, ...newCase, status: "open", createdBy: currentUser?.id, createdAt: new Date().toISOString().slice(0, 10), alertCount: 0, slaHours: 24, tags: [newCase.type.toLowerCase().replace(/ /g, "")] };
    setCases(p => [c, ...p]);
    addLog("CREATE_CASE", "case", c.id, `Création case '${c.name}' — Priorité ${c.priority}`, "Cases");
    setShowCreate(false);
    setNewCase({ name: "", description: "", type: ALL_FRAUD_TYPES[0], priority: "high", assignedTo: [] });
  }

  function updateStatus(caseId, status) {
    setCases(p => p.map(c => c.id === caseId ? { ...c, status } : c));
    addLog("UPDATE_CASE_STATUS", "case", caseId, `Statut case → ${status}`, "Cases");
  }

  const priColor = { critical: C.danger, high: C.warning, medium: C.sky, low: C.success };
  const statusColors = { open: C.danger, investigating: C.warning, closed: C.success };
  const statusLabels = { open: "Ouvert", investigating: "En cours", closed: "Fermé" };

  const caseAlerts = selectedCase ? alerts.filter(a => a.caseId === selectedCase.id) : [];

  return (
    <div style={{ padding: "28px 30px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <SectionHeader title="Case Management" sub={`${cases.filter(c => c.status !== "closed").length} cases actifs · ${cases.length} total`}
        action={can("createCases") && <Btn onClick={() => setShowCreate(true)}>+ Nouveau case</Btn>} />

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        {[{ l: "Ouverts", v: cases.filter(c => c.status === "open").length, c: C.danger },
          { l: "En cours", v: cases.filter(c => c.status === "investigating").length, c: C.warning },
          { l: "Fermés", v: cases.filter(c => c.status === "closed").length, c: C.success },
          { l: "Total alertes", v: cases.reduce((a, c) => a + c.alertCount, 0), c: C.sky }].map(s => (
          <Card key={s.l} style={{ flex: 1, padding: "14px 18px" }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 12, color: C.textL, marginTop: 4 }}>{s.l}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un case..." />
        <Select value={filterStatus} onChange={setFilterStatus} options={[{ value: "all", label: "Tous statuts" }, { value: "open", label: "Ouvert" }, { value: "investigating", label: "En cours" }, { value: "closed", label: "Fermé" }]} />
        <Select value={filterPriority} onChange={setFilterPriority} options={[{ value: "all", label: "Toutes priorités" }, { value: "critical", label: "Critique" }, { value: "high", label: "Élevé" }, { value: "medium", label: "Moyen" }]} />
        <Select value={filterType} onChange={setFilterType} options={[{ value: "all", label: "Tous types" }, ...ALL_FRAUD_TYPES.map(t => ({ value: t, label: t }))]} />
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        {/* Cases list */}
        <div style={{ flex: selectedCase ? 1 : 2 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map(c => {
              const assignedUsers = users.filter(u => c.assignedTo?.includes(u.id));
              const isSelected = selectedCase?.id === c.id;
              return (
                <Card key={c.id} onClick={() => setSelectedCase(isSelected ? null : c)} style={{ padding: "16px 20px", borderLeft: `4px solid ${priColor[c.priority] || C.muted}`, background: isSelected ? C.skyL : C.white }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ fontSize: 20 }}>{fraudCatIcon(c.type)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>{c.name}</span>
                        <Badge label={statusLabels[c.status] || c.status} color={statusColors[c.status] || C.muted} small />
                        <Badge label={c.priority === "critical" ? "Critique" : c.priority === "high" ? "Élevé" : "Moyen"} color={priColor[c.priority] || C.muted} small />
                        <Badge label={c.type} color={fraudCatColor(c.type)} small />
                      </div>
                      <p style={{ margin: "0 0 10px", fontSize: 12, color: C.textL, lineHeight: 1.5 }}>{c.description}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: C.muted }}>📅 {c.createdAt}</span>
                        <span style={{ fontSize: 11, color: C.sky, fontWeight: 600 }}>🔔 {c.alertCount} alertes</span>
                        {c.tags?.map(t => <span key={t} style={{ background: C.mutedL, color: C.textL, borderRadius: 4, padding: "1px 6px", fontSize: 10 }}>#{t}</span>)}
                        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                          {assignedUsers.map(u => <Avatar key={u.id} user={u} size={24} />)}
                        </div>
                        <select value={c.status} onChange={e => { e.stopPropagation(); updateStatus(c.id, e.target.value); }} style={{ border: `1px solid ${C.mutedL}`, borderRadius: 6, padding: "4px 8px", fontSize: 11, color: C.navy, background: C.white, cursor: "pointer" }} onClick={e => e.stopPropagation()}>
                          <option value="open">Ouvert</option>
                          <option value="investigating">En cours</option>
                          <option value="closed">Fermé</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
            {filtered.length === 0 && (
              <Card style={{ padding: "40px", textAlign: "center", color: C.muted }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                <p style={{ margin: 0 }}>Aucun case trouvé</p>
              </Card>
            )}
          </div>
        </div>

        {/* Case detail */}
        {selectedCase && (
          <div style={{ flex: 1 }}>
            <Card style={{ padding: "18px 20px", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Alertes liées ({caseAlerts.length})</div>
              {caseAlerts.length === 0 ? <p style={{ margin: 0, color: C.muted, fontSize: 12 }}>Aucune alerte associée</p> : caseAlerts.map(a => (
                <div key={a.id} onClick={() => setSimProfile({ msisdn: a.msisdn, score: a.score, fraudType: a.type })} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.mutedL}`, cursor: "pointer" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: sevColor(a.severity), flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>{a.type}</div>
                    <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>{a.msisdn}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: a.score >= 80 ? C.danger : C.warning }}>{a.score}</div>
                </div>
              ))}
            </Card>
            <Card style={{ padding: "18px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Analystes assignés</div>
              {users.filter(u => selectedCase.assignedTo?.includes(u.id)).map(u => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <Avatar user={u} size={32} />
                  <div><div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{u.name}</div><div style={{ fontSize: 11, color: C.muted }}>{u.email}</div></div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Nouveau case" onClose={() => setShowCreate(false)} width={580}>
          <div style={{ padding: "20px 24px" }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Nom du case</label>
              <input value={newCase.name} onChange={e => setNewCase(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Foyer SIM Box — Plateau Dakar" style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.navy, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Description</label>
              <textarea value={newCase.description} onChange={e => setNewCase(f => ({ ...f, description: e.target.value }))} rows={3} style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.navy, outline: "none", boxSizing: "border-box", resize: "vertical" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Type de fraude</label>
                <select value={newCase.type} onChange={e => setNewCase(f => ({ ...f, type: e.target.value }))} style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.navy, background: C.white, outline: "none" }}>
                  {Object.entries(FRAUD_CATEGORIES).map(([cat, def]) => (
                    <optgroup key={cat} label={`${def.icon} ${cat}`}>
                      {def.types.map(t => <option key={t} value={t}>{t}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Priorité</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[{ k: "critical", l: "Critique", c: C.danger }, { k: "high", l: "Élevé", c: C.warning }, { k: "medium", l: "Moyen", c: C.sky }].map(p => (
                    <button key={p.k} onClick={() => setNewCase(f => ({ ...f, priority: p.k }))} style={{ flex: 1, padding: "8px", background: newCase.priority === p.k ? `${p.c}18` : C.bg, border: `2px solid ${newCase.priority === p.k ? p.c : C.mutedL}`, borderRadius: 8, color: newCase.priority === p.k ? p.c : C.textL, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>{p.l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Assigner à</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {analysts.map(u => (
                  <button key={u.id} onClick={() => setNewCase(f => ({ ...f, assignedTo: f.assignedTo.includes(u.id) ? f.assignedTo.filter(x => x !== u.id) : [...f.assignedTo, u.id] }))} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: newCase.assignedTo.includes(u.id) ? C.skyL : C.bg, border: `1px solid ${newCase.assignedTo.includes(u.id) ? C.sky : C.mutedL}`, borderRadius: 8, cursor: "pointer", fontSize: 12, color: newCase.assignedTo.includes(u.id) ? C.sky : C.textL, fontWeight: newCase.assignedTo.includes(u.id) ? 700 : 400 }}>
                    <Avatar user={u} size={20} />{u.name.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" onClick={() => setShowCreate(false)} style={{ flex: 1, justifyContent: "center" }}>Annuler</Btn>
              <Btn onClick={createCase} disabled={!newCase.name} style={{ flex: 2, justifyContent: "center" }}>📁 Créer le case</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}