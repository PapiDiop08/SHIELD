// ── SHIELD Cases Page — FULL LINK ────────────────────────────────────────────
// Données depuis AAR DB — plus de MOCK_CASES

import { useState, useMemo, useCallback, useEffect } from "react";
import { C, sevColor, fraudCatIcon, fraudCatColor, FRAUD_CATEGORIES, ALL_FRAUD_TYPES } from "../theme.js";
import { Card, Badge, Btn, SearchInput, Select, SectionHeader, Modal, Avatar } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";
import { supabase } from "../supabase.js";

// ── Hook interne — Cases depuis AAR DB ──────────────────────────────────
function useCases(operatorIdFilter) {
  const [cases, setCasesState] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("cases")
        .select("*")
        .order("created_at", { ascending: false });
      if (operatorIdFilter) q = q.eq("operator_id", operatorIdFilter);
      const { data, error } = await q;
      if (error) throw error;
      // Normaliser pour correspondre au format attendu par le composant
      setCasesState((data || []).map(c => ({
        id: c.id,
        name: c.name,
        description: c.description || "",
        type: c.fraud_type,
        status: c.status,
        priority: c.priority,
        assignedTo: Array.isArray(c.assigned_to) ? c.assigned_to : [],
        createdBy: c.created_by,
        creatorName: "AAR",
        createdAt: c.created_at?.slice(0, 10),
        tags: Array.isArray(c.tags) ? c.tags : [],
        alertCount: c.alert_count || 0,
        slaHours: c.sla_hours || 24,
        operator: c.operator || c.operator_id || "—",
        operatorId: c.operator_id,
      })));
    } catch (err) {
      console.error("useCases fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [operatorIdFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime
  useEffect(() => {
    const sub = supabase.channel("cases-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "cases" }, fetch)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [fetch]);

  const createCase = useCallback(async (caseData, operatorId) => {
    const { data, error } = await supabase.from("cases").insert([{
      name: caseData.name,
      description: caseData.description || null,
      fraud_type: caseData.type,
      status: "open",
      priority: caseData.priority || "high",
      assigned_to: [],
      operator_id: operatorId || null,
      alert_count: 0,
      sla_hours: caseData.slaHours || 24,
      tags: Array.isArray(caseData.tags) ? caseData.tags : [],
    }]).select();
    if (!error) await fetch();
    return { data, error };
  }, [fetch]);

  const updateCaseStatus = useCallback(async (id, status) => {
    await supabase.from("cases").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    setCasesState(p => p.map(c => c.id === id ? { ...c, status } : c));
  }, []);

  const deleteCase = useCallback(async (id) => {
    await supabase.from("cases").delete().eq("id", id);
    setCasesState(p => p.filter(c => c.id !== id));
  }, []);

  return { cases, loading, fetch, createCase, updateCaseStatus, deleteCase };
}

// ── Composant principal ───────────────────────────────────────────────────
export default function Cases({ alerts, users, setSimProfile, addLog, navigate, currentOperator, operatorIdFilter }) {
  const { currentUser, can } = useAuth();

  const { cases, loading, createCase, updateCaseStatus } = useCases(operatorIdFilter);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [newCase, setNewCase] = useState({
    name: "", description: "", type: ALL_FRAUD_TYPES[0], priority: "high", assignedTo: []
  });
  const [creating, setCreating] = useState(false);
  const [caseLinkedAlerts, setCaseLinkedAlerts] = useState([]);

  // Fetch alerts linked to selected case directly from Supabase
  useEffect(() => {
    if (!selectedCase) { setCaseLinkedAlerts([]); return; }
    supabase.from("alerts").select("*")
      .eq("case_id", selectedCase.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setCaseLinkedAlerts(data || []));
  }, [selectedCase?.id]);

  const analysts = (users||[]).filter(u => u.active && ["analyst", "admin", "superadmin", "gfm_analyst"].includes(u.role));

  const filtered = useMemo(() => {
    let list = [...cases];
    if (search) list = list.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description || "").toLowerCase().includes(search.toLowerCase())
    );
    if (filterStatus !== "all") list = list.filter(c => c.status === filterStatus);
    if (filterPriority !== "all") list = list.filter(c => c.priority === filterPriority);
    if (filterType !== "all") list = list.filter(c => c.type === filterType);
    return list;
  }, [cases, search, filterStatus, filterPriority, filterType]);

  async function handleCreateCase() {
    if (!newCase.name.trim()) return;
    setCreating(true);
    try {
      const { error } = await createCase(
        { ...newCase, createdBy: currentUser?.id, tags: [newCase.type.toLowerCase().replace(/ /g, "")] },
        currentOperator?.id || null
      );
      if (!error) {
        addLog?.("CREATE_CASE", "case", null, `Création case '${newCase.name}' — Priorité ${newCase.priority}`, "Cases");
        setShowCreate(false);
        setNewCase({ name: "", description: "", type: ALL_FRAUD_TYPES[0], priority: "high", assignedTo: [] });
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateStatus(caseId, status) {
    await updateCaseStatus(caseId, status);
    addLog?.("UPDATE_CASE_STATUS", "case", caseId, `Statut case → ${status}`, "Cases");
    if (selectedCase?.id === caseId) setSelectedCase(p => ({ ...p, status }));
  }

  const priColor = { critical: C.danger, high: C.warning, medium: C.sky, low: C.success };
  const statusColors = { open: C.danger, in_progress: C.warning, investigating: C.warning, pending: C.sky, closed: C.success, escalated: C.danger };
  const statusLabels = { open: "Ouvert", in_progress: "En cours", investigating: "En cours", pending: "En attente", closed: "Fermé", escalated: "Escaladé" };

  // caseLinkedAlerts is fetched directly from Supabase by useEffect above

  return (
    <div style={{ padding: "28px 30px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <SectionHeader
        title="Case Management"
        sub={loading
          ? "Chargement chargement…"
          : `${(cases||[]).filter(c => c.status !== "closed").length} cases actifs · ${cases.length} total `
        }
        action={can("createCases") && (
          <Btn onClick={() => setShowCreate(true)}>+ Nouveau case</Btn>
        )}
      />

      {/* Stats */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
        {[
          { l: "Ouverts", v: (cases||[]).filter(c => c.status === "open").length, c: C.danger },
          { l: "En cours", v: (cases||[]).filter(c => ["in_progress", "investigating"].includes(c.status)).length, c: C.warning },
          { l: "Escaladés", v: (cases||[]).filter(c => c.status === "escalated").length, c: C.purple },
          { l: "Fermés", v: (cases||[]).filter(c => c.status === "closed").length, c: C.success },
          { l: "Total alertes", v: cases.reduce((a, c) => a + (c.alertCount || 0), 0), c: C.sky },
        ].map(s => (
          <Card key={s.l} style={{ flex: 1, padding: "14px 18px" }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.c }}>
              {loading ? "…" : s.v}
            </div>
            <div style={{ fontSize: 12, color: C.textL, marginTop: 4 }}>{s.l}</div>
          </Card>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un case..." />
        <Select value={filterStatus} onChange={setFilterStatus} options={[
          { value: "all", label: "Tous statuts" },
          { value: "open", label: "Ouvert" },
          { value: "in_progress", label: "En cours" },
          { value: "escalated", label: "Escaladé" },
          { value: "pending", label: "En attente" },
          { value: "closed", label: "Fermé" },
        ]} />
        <Select value={filterPriority} onChange={setFilterPriority} options={[
          { value: "all", label: "Toutes priorités" },
          { value: "critical", label: "Critique" },
          { value: "high", label: "Élevé" },
          { value: "medium", label: "Moyen" },
          { value: "low", label: "Faible" },
        ]} />
        <Select value={filterType} onChange={setFilterType} options={[
          { value: "all", label: "Tous types" },
          ...ALL_FRAUD_TYPES.map(t => ({ value: t, label: t })),
        ]} />
      </div>

      {/* Loading state */}
      {loading && (
        <Card style={{ padding: "40px", textAlign: "center", color: C.muted }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Chargement…</div>
          <p style={{ margin: 0 }}>Chargement des cases chargement…</p>
        </Card>
      )}

      {!loading && (
        <div style={{ display: "flex", gap: 20 }}>
          {/* Liste cases */}
          <div style={{ flex: selectedCase ? 1 : 2 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filtered.map(c => {
                const assignedUsers = (users||[]).filter(u => c.assignedTo?.includes(u.id));
                const isSelected = selectedCase?.id === c.id;
                return (
                  <Card key={c.id}
                    onClick={() => setSelectedCase(isSelected ? null : c)}
                    style={{
                      padding: "16px 20px",
                      borderLeft: `4px solid ${priColor[c.priority] || C.muted}`,
                      background: isSelected ? C.skyL : C.white,
                    }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ fontSize: 20 }}>{fraudCatIcon(c.type)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>{c.name}</span>
                          <Badge label={statusLabels[c.status] || c.status} color={statusColors[c.status] || C.muted} small />
                          <Badge
                            label={c.priority === "critical" ? "Critique" : c.priority === "high" ? "Élevé" : c.priority === "medium" ? "Moyen" : "Faible"}
                            color={priColor[c.priority] || C.muted} small
                          />
                          <Badge label={c.type} color={fraudCatColor(c.type)} small />
                        </div>
                        <p style={{ margin: "0 0 10px", fontSize: 12, color: C.textL, lineHeight: 1.5 }}>
                          {c.description}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, color: C.muted }}>Date {c.createdAt}</span>
                          <span style={{ fontSize: 11, color: C.sky, fontWeight: 600 }}>[ {c.alertCount} alertes</span>
                          <span style={{ fontSize: 11, color: C.muted }}>⏱ SLA {c.slaHours}h</span>
                          {c.operator && <span style={{ fontSize: 11, color: C.muted }}>Opérateur: {c.operator}</span>}
                          {(c.tags || []).map(t => (
                            <span key={t} style={{ background: C.mutedL, color: C.textL, borderRadius: 4, padding: "1px 6px", fontSize: 10 }}>
                              #{t}
                            </span>
                          ))}
                          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                            {assignedUsers.map(u => <Avatar key={u.id} user={u} size={24} />)}
                          </div>
                          <select
                            value={c.status}
                            onChange={e => { e.stopPropagation(); handleUpdateStatus(c.id, e.target.value); }}
                            onClick={e => e.stopPropagation()}
                            style={{
                              border: `1px solid ${C.mutedL}`, borderRadius: 6,
                              padding: "4px 8px", fontSize: 11, color: C.navy,
                              background: C.white, cursor: "pointer",
                            }}>
                            <option value="open">Ouvert</option>
                            <option value="in_progress">En cours</option>
                            <option value="pending">En attente</option>
                            <option value="escalated">Escaladé</option>
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
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Aucun case</div>
                  <p style={{ margin: 0 }}>Aucun case trouvé</p>
                </Card>
              )}
            </div>
          </div>

          {/* Détail case sélectionné */}
          {selectedCase && (
            <div style={{ flex: 1 }}>
              <Card style={{ padding: "18px 20px", marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
                    Alertes liées ({caseLinkedAlerts.length})
                  </div>
                  <button onClick={() => setSelectedCase(null)}
                    style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16 }}>
                    X
                  </button>
                </div>
                {caseLinkedAlerts.length === 0
                  ? <p style={{ margin: 0, color: C.muted, fontSize: 12 }}>Aucune alerte associée à ce case</p>
                  : caseLinkedAlerts.map(a => (
                    <div key={a.id}
                      onClick={() => setSimProfile({ msisdn: a.msisdn, score: a.score, fraudType: a.type })}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.mutedL}`, cursor: "pointer" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: sevColor(a.severity), flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>{a.type}</div>
                        <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>{a.msisdn}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: a.score >= 80 ? C.danger : C.warning }}>
                        {a.score}
                      </div>
                    </div>
                  ))}
              </Card>

              <Card style={{ padding: "18px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12 }}>
                  Analystes assignés
                </div>
                {(users||[]).filter(u => selectedCase.assignedTo?.includes(u.id)).length === 0
                  ? <p style={{ margin: 0, color: C.muted, fontSize: 12 }}>Aucun analyste assigné</p>
                  : (users||[]).filter(u => selectedCase.assignedTo?.includes(u.id)).map(u => (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <Avatar user={u} size={32} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{u.email}</div>
                      </div>
                    </div>
                  ))}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Modal création */}
      {showCreate && (
        <Modal title="Nouveau case" onClose={() => setShowCreate(false)} width={580}>
          <div style={{ padding: "20px 24px" }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>
                Nom du case *
              </label>
              <input
                value={newCase.name}
                onChange={e => setNewCase(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Foyer SIM Box — Plateau Dakar"
                style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.navy, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>
                Description
              </label>
              <textarea
                value={newCase.description}
                onChange={e => setNewCase(f => ({ ...f, description: e.target.value }))}
                rows={3}
                style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.navy, outline: "none", boxSizing: "border-box", resize: "vertical" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>
                  Type de fraude
                </label>
                <select
                  value={newCase.type}
                  onChange={e => setNewCase(f => ({ ...f, type: e.target.value }))}
                  style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: C.navy, background: C.white, outline: "none" }}>
                  {Object.entries(FRAUD_CATEGORIES).map(([cat, def]) => (
                    <optgroup key={cat} label={`${def.icon} ${cat}`}>
                      {def.types.map(t => <option key={t} value={t}>{t}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>
                  Priorité
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { k: "critical", l: "Critique", c: C.danger },
                    { k: "high", l: "Élevé", c: C.warning },
                    { k: "medium", l: "Moyen", c: C.sky },
                  ].map(p => (
                    <button key={p.k}
                      onClick={() => setNewCase(f => ({ ...f, priority: p.k }))}
                      style={{
                        flex: 1, padding: "8px",
                        background: newCase.priority === p.k ? `${p.c}18` : C.bg,
                        border: `2px solid ${newCase.priority === p.k ? p.c : C.mutedL}`,
                        borderRadius: 8, color: newCase.priority === p.k ? p.c : C.textL,
                        cursor: "pointer", fontSize: 11, fontWeight: 700,
                      }}>
                      {p.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>
                Assigner à
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {analysts.map(u => (
                  <button key={u.id}
                    onClick={() => setNewCase(f => ({
                      ...f,
                      assignedTo: f.assignedTo.includes(u.id)
                        ? f.assignedTo.filter(x => x !== u.id)
                        : [...f.assignedTo, u.id],
                    }))}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 10px",
                      background: newCase.assignedTo.includes(u.id) ? C.skyL : C.bg,
                      border: `1px solid ${newCase.assignedTo.includes(u.id) ? C.sky : C.mutedL}`,
                      borderRadius: 8, cursor: "pointer", fontSize: 12,
                      color: newCase.assignedTo.includes(u.id) ? C.sky : C.textL,
                      fontWeight: newCase.assignedTo.includes(u.id) ? 700 : 400,
                    }}>
                    <Avatar user={u} size={20} />
                    {u.name.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" onClick={() => setShowCreate(false)} style={{ flex: 1, justifyContent: "center" }}>
                Annuler
              </Btn>
              <Btn
                onClick={handleCreateCase}
                disabled={!newCase.name.trim() || creating}
                style={{ flex: 2, justifyContent: "center" }}>
                {creating ? "Création…" : "Créer le case"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}