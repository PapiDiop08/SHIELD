// ── AAR Telco — Distributeurs SIM v1.0 ───────────────────────────────────────
// Surveillance réseau distributeurs : vente SIM cards, taux fraude, score risque.

import { useState, useMemo, useEffect } from "react";
import { C } from "../theme.js";
import { Card, Badge, Btn, SectionHeader, SearchInput, Select, TableWrap, EmptyState, Modal } from "../components.jsx";
import { supabase } from "../supabase.js";

const fmtNum = (n) => (n || 0).toLocaleString("fr-FR");

const toRisk = (score) => {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
};
const riskColor = (r) => ({ critical: C.danger, high: C.warning, medium: C.sky, low: C.success }[r] || C.muted);
const riskLabel = (r) => ({ critical: "Critique", high: "Élevé", medium: "Moyen", low: "Faible" }[r] || "—");
const typeLabel = (t) => t === "individual" ? "Individuel" : t === "small_business" ? "Petite entreprise" : t || "—";
const typeColor = (t) => t === "individual" ? C.sky : t === "small_business" ? C.purple : C.muted;

// ── Generate mock SIMs for a distributor ─────────────────────────────────────
function generateSims(distributor) {
  const count = distributor.sims_sold || Math.floor(Math.random() * 50 + 10);
  return Array.from({ length: count }, (_, i) => ({
    id: `SIM-${(distributor.id?.slice(0, 4) || "D001")}-${String(i + 1).padStart(3, "0")}`,
    msisdn: `+221 7${Math.floor(Math.random() * 9 + 1)} ${String(Math.floor(Math.random() * 9000000 + 1000000)).replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4")}`,
    status: i < (distributor.fraud_sims || 0) ? "blocked" : Math.random() > 0.85 ? "flagged" : "active",
    activatedAt: new Date(Date.now() - Math.random() * 90 * 24 * 3600 * 1000).toLocaleDateString("fr-FR"),
    calls: Math.floor(Math.random() * 500),
    riskScore: i < (distributor.fraud_sims || 0) ? Math.floor(Math.random() * 30 + 70) : Math.floor(Math.random() * 40),
  }));
}

const simStatusColor = (s) => s === "blocked" ? C.danger : s === "flagged" ? C.warning : C.success;
const simStatusLabel = (s) => s === "blocked" ? "Bloquée" : s === "flagged" ? "Flaggée" : "Active";

// ── SIMs Tab ──────────────────────────────────────────────────────────────────
function SimsTab({ dist }) {
  const [sims, setSims] = useState(() => generateSims(dist));
  const [simSearch, setSimSearch] = useState("");
  const [blocking, setBlocking] = useState(null);

  const filtered = simSearch
    ? sims.filter(s => s.msisdn.replace(/\s/g, "").includes(simSearch.replace(/\s/g, "")) || s.id.toLowerCase().includes(simSearch.toLowerCase()))
    : sims;

  const stats = {
    total: sims.length,
    active: sims.filter(s => s.status === "active").length,
    flagged: sims.filter(s => s.status === "flagged").length,
    blocked: sims.filter(s => s.status === "blocked").length,
  };

  async function blockSim(sim) {
    setBlocking(sim.id);
    try {
      await supabase.from("blockings").insert({
        id: crypto.randomUUID(),
        msisdn: sim.msisdn.replace(/\s/g, ""),
        reason: `Bloqué depuis distributeur ${dist.name}`,
        source: "distributor_action",
        active: true,
        operator: dist.operator || "AAR Telco",
        created_at: new Date().toISOString(),
      });
    } catch (_) { /* best effort */ }
    setSims(prev => prev.map(s => s.id === sim.id ? { ...s, status: "blocked" } : s));
    setBlocking(null);
  }

  async function unblockSim(sim) {
    setSims(prev => prev.map(s => s.id === sim.id ? { ...s, status: "active" } : s));
  }

  async function blockAll() {
    const toBlock = sims.filter(s => s.status !== "blocked");
    for (const sim of toBlock) {
      try {
        await supabase.from("blockings").insert({
          id: crypto.randomUUID(),
          msisdn: sim.msisdn.replace(/\s/g, ""),
          reason: `Blocage masse — distributeur ${dist.name}`,
          source: "distributor_action",
          active: true,
          operator: dist.operator || "AAR Telco",
          created_at: new Date().toISOString(),
        });
      } catch (_) { /* best effort */ }
    }
    setSims(prev => prev.map(s => ({ ...s, status: "blocked" })));
  }

  function unblockAll() {
    setSims(prev => prev.map(s => ({ ...s, status: "active" })));
  }

  return (
    <div>
      {/* Stats rapides */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { label: "Total", value: stats.total, color: C.navy },
          { label: "Actives", value: stats.active, color: C.success },
          { label: "Flaggées", value: stats.flagged, color: C.warning },
          { label: "Bloquées", value: stats.blocked, color: C.danger },
        ].map((s, i) => (
          <div key={i} style={{ background: C.bg, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Actions masse */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={blockAll}
          style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "none", background: C.danger, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          Tout bloquer
        </button>
        <button
          onClick={unblockAll}
          style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "none", background: C.success, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          Tout débloquer
        </button>
      </div>

      {/* Recherche MSISDN */}
      <input
        value={simSearch}
        onChange={e => setSimSearch(e.target.value)}
        placeholder="Rechercher MSISDN ou ID SIM..."
        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.mutedL}`, fontSize: 12, color: C.text, outline: "none", boxSizing: "border-box", marginBottom: 10 }}
      />

      {/* Tableau SIMs */}
      <div style={{ border: `1px solid ${C.mutedL}`, borderRadius: 10, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.9fr 0.7fr 0.6fr 0.8fr 0.8fr", gap: 0, padding: "8px 10px", background: C.bg, fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
          <div>MSISDN</div>
          <div>Statut</div>
          <div>Risque</div>
          <div>Appels</div>
          <div>Activée</div>
          <div>Action</div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: C.muted, fontSize: 12 }}>Aucune SIM trouvée</div>
        ) : filtered.map(sim => (
          <div key={sim.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.9fr 0.7fr 0.6fr 0.8fr 0.8fr", gap: 0, padding: "9px 10px", borderTop: `1px solid ${C.mutedL}`, alignItems: "center", fontSize: 11 }}>
            <div>
              <div style={{ fontFamily: "monospace", fontWeight: 700, color: C.navy, fontSize: 10 }}>{sim.msisdn}</div>
              <div style={{ fontSize: 9, color: C.muted }}>{sim.id}</div>
            </div>
            <div>
              <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 6, background: simStatusColor(sim.status) + "20", color: simStatusColor(sim.status), fontSize: 10, fontWeight: 700 }}>
                {simStatusLabel(sim.status)}
              </span>
            </div>
            <div style={{ fontWeight: 700, color: riskColor(toRisk(sim.riskScore)) }}>{sim.riskScore}</div>
            <div style={{ color: C.textL }}>{fmtNum(sim.calls)}</div>
            <div style={{ color: C.muted, fontSize: 10 }}>{sim.activatedAt}</div>
            <div>
              {sim.status === "blocked" ? (
                <button
                  onClick={() => unblockSim(sim)}
                  style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: C.success + "20", color: C.success, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                  Débloquer
                </button>
              ) : (
                <button
                  disabled={blocking === sim.id}
                  onClick={() => blockSim(sim)}
                  style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: C.danger + "20", color: C.danger, fontSize: 10, fontWeight: 700, cursor: "pointer", opacity: blocking === sim.id ? 0.6 : 1 }}>
                  {blocking === sim.id ? "…" : "Bloquer"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Distributor Detail Panel ──────────────────────────────────────────────────
function DistributorPanel({ dist, onClose, onFlag }) {
  const [activeTab, setActiveTab] = useState("apercu");
  const risk = toRisk(dist.risk_score || 0);
  const fraudPct = dist.fraud_rate ? (dist.fraud_rate * 100).toFixed(1) : ((dist.fraud_sims || 0) / (dist.sims_sold || 1) * 100).toFixed(1);

  const tabs = [
    { id: "apercu", label: "Aperçu" },
    { id: "sims", label: "SIMs" },
  ];

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 520, background: C.white, boxShadow: "-8px 0 32px rgba(0,0,0,0.15)", zIndex: 1000, overflowY: "auto", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      {/* Header */}
      <div style={{ background: C.navy, padding: "24px 24px 0", color: C.white }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Profil distributeur</div>
            <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 900 }}>{dist.distributor_id || dist.id}</div>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{dist.name} · {dist.city || "—"}</div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{dist.operator} · {typeLabel(dist.type)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            {dist.flagged && <Badge label="Flagué" color={C.danger} />}
            <Badge label={riskLabel(risk)} color={riskColor(risk)} />
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: C.white, borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 0 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 20px",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid #fff" : "2px solid transparent",
                color: activeTab === tab.id ? "#fff" : "rgba(255,255,255,0.5)",
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "'DM Sans','Segoe UI',sans-serif",
              }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {activeTab === "apercu" && (
          <>
            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
              {[
                { label: "SIMs vendues", value: fmtNum(dist.sims_sold), color: C.navy },
                { label: "SIMs fraude", value: fmtNum(dist.fraud_sims), color: C.danger },
                { label: "Taux fraude", value: fraudPct + "%", color: parseFloat(fraudPct) > 10 ? C.danger : parseFloat(fraudPct) > 5 ? C.warning : C.success },
                { label: "Score risque", value: `${dist.risk_score || 0}/100`, color: riskColor(risk) },
                { label: "Ville", value: dist.city || "—", color: C.textL },
                { label: "Pays", value: dist.country || "—", color: C.textL },
                { label: "Opérateur", value: dist.operator || "—", color: C.navy },
                { label: "Type", value: typeLabel(dist.type), color: typeColor(dist.type) },
              ].map((k, i) => (
                <div key={i} style={{ background: C.bg, borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Risk bar */}
            <Card style={{ padding: "14px 16px", marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10 }}>Score de risque global</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, height: 10, background: C.mutedL, borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ width: `${dist.risk_score || 0}%`, height: "100%", background: riskColor(risk), borderRadius: 6, transition: "width 0.4s" }} />
                </div>
                <span style={{ fontSize: 18, fontWeight: 900, color: riskColor(risk), minWidth: 40 }}>{dist.risk_score || 0}</span>
              </div>
              <div style={{ marginTop: 8 }}>
                <Badge label={riskLabel(risk)} color={riskColor(risk)} />
              </div>
            </Card>

            {/* Fraude indicator */}
            {parseFloat(fraudPct) > 5 && (
              <div style={{ background: C.danger + "0D", border: `1px solid ${C.danger}33`, borderRadius: 10, padding: "12px 16px", marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.danger, marginBottom: 4 }}>! Taux de fraude élevé : {fraudPct}%</div>
                <div style={{ fontSize: 11, color: C.textL }}>{fmtNum(dist.fraud_sims)} SIM(s) sur {fmtNum(dist.sims_sold)} liées à des activités frauduleuses détectées.</div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              {dist.flagged ? (
                <Btn variant="success" style={{ flex: 1 }} onClick={() => onFlag && onFlag(dist.id, false)}>Lever le flag</Btn>
              ) : (
                <Btn variant="danger" style={{ flex: 1 }} onClick={() => onFlag && onFlag(dist.id, true)}>Flaguer distributeur</Btn>
              )}
              <Btn variant="ghost" style={{ flex: 1 }}>Signaler à l'opérateur</Btn>
            </div>
          </>
        )}

        {activeTab === "sims" && <SimsTab dist={dist} />}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Distributors({ addLog, operators }) {
  const [distributors, setDistributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDist, setSelectedDist] = useState(null);
  const [search, setSearch] = useState("");
  const [filterOp, setFilterOp] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("fraud_rate");
  const [sortDir, setSortDir] = useState("desc");

  const ops = operators || [];

  // ── Fetch from Supabase ───────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase.from("distributors").select("*").order("risk_score", { ascending: false });
      if (!error && data) setDistributors(data);
      setLoading(false);
    }
    load();
  }, []);

  // ── Flag / unflag ─────────────────────────────────────────────────────────
  async function handleFlag(id, flagged) {
    const { error } = await supabase.from("distributors").update({ flagged }).eq("id", id);
    if (!error) {
      setDistributors(prev => prev.map(d => d.id === id ? { ...d, flagged } : d));
      if (selectedDist?.id === id) setSelectedDist(prev => ({ ...prev, flagged }));
      addLog?.("FLAG_DISTRIBUTOR", "distributor", id, `Distributeur ${id} ${flagged ? "flagué" : "déflagué"}`, "Distributeurs");
    }
  }

  // ── Filtering + sorting ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...distributors];
    if (search) list = list.filter(d =>
      (d.distributor_id || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (d.city || "").toLowerCase().includes(search.toLowerCase())
    );
    if (filterOp !== "all") list = list.filter(d => d.operator === filterOp);
    if (filterType !== "all") list = list.filter(d => d.type === filterType);
    if (flaggedOnly) list = list.filter(d => d.flagged);
    list.sort((a, b) => {
      let va, vb;
      if (sortBy === "fraud_rate") { va = a.fraud_rate || (a.fraud_sims / (a.sims_sold || 1)); vb = b.fraud_rate || (b.fraud_sims / (b.sims_sold || 1)); }
      else if (sortBy === "risk_score") { va = a.risk_score || 0; vb = b.risk_score || 0; }
      else if (sortBy === "sims_sold") { va = a.sims_sold || 0; vb = b.sims_sold || 0; }
      else if (sortBy === "fraud_sims") { va = a.fraud_sims || 0; vb = b.fraud_sims || 0; }
      else { va = a.name || ""; vb = b.name || ""; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [distributors, search, filterOp, filterType, flaggedOnly, sortBy, sortDir]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalDist = distributors.length;
  const flagued = distributors.filter(d => d.flagged).length;
  const totalFraudSims = distributors.reduce((s, d) => s + (d.fraud_sims || 0), 0);
  const avgFraudRate = distributors.length > 0
    ? (distributors.reduce((s, d) => s + (d.fraud_rate || (d.fraud_sims / (d.sims_sold || 1))), 0) / distributors.length * 100).toFixed(1)
    : "0.0";

  // ── Sort helper ───────────────────────────────────────────────────────────
  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  }
  const sortIcon = (col) => sortBy === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div style={{ padding: "28px 30px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <SectionHeader
        title="Distributeurs SIM"
        sub={`${totalDist} distributeurs · ${flagued} flagués · ${fmtNum(totalFraudSims)} SIMs fraude détectées`}
      />

      {/* Stats header */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Total distributeurs", value: totalDist, color: C.navy },
          { label: "Distributeurs flagués", value: flagued, color: C.danger },
          { label: "SIMs fraude total", value: fmtNum(totalFraudSims), color: C.warning },
          { label: "Taux fraude moyen", value: avgFraudRate + "%", color: parseFloat(avgFraudRate) > 5 ? C.danger : parseFloat(avgFraudRate) > 2 ? C.warning : C.success },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, minWidth: 150, background: C.white, border: `1px solid ${C.mutedL}`, borderTop: `3px solid ${s.color}`, borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.textL, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <SearchInput value={search} onChange={setSearch} placeholder="ID, nom, ville..." />
        <Select value={filterOp} onChange={setFilterOp} options={[
          { value: "all", label: "Tous opérateurs" },
          ...([...new Set(distributors.map(d => d.operator).filter(Boolean))].map(o => ({ value: o, label: o }))),
        ]} />
        <Select value={filterType} onChange={setFilterType} options={[
          { value: "all", label: "Tous types" },
          { value: "individual", label: "Individuel" },
          { value: "small_business", label: "Petite entreprise" },
        ]} />
        <button
          onClick={() => setFlaggedOnly(f => !f)}
          style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${flaggedOnly ? C.danger : C.mutedL}`, background: flaggedOnly ? C.danger + "15" : C.white, color: flaggedOnly ? C.danger : C.textL, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
          {flaggedOnly ? "● " : "○ "}Flagués seulement
        </button>
        <Select value={`${sortBy}-${sortDir}`} onChange={v => { const [b, d] = v.split("-"); setSortBy(b); setSortDir(d); }} options={[
          { value: "fraud_rate-desc", label: "Taux fraude ↓" },
          { value: "fraud_rate-asc", label: "Taux fraude ↑" },
          { value: "risk_score-desc", label: "Score risque ↓" },
          { value: "sims_sold-desc", label: "SIMs vendues ↓" },
          { value: "name-asc", label: "Nom A→Z" },
        ]} />
      </div>

      <div style={{ fontSize: 12, color: C.textL, marginBottom: 8 }}>{filtered.length} distributeur{filtered.length > 1 ? "s" : ""}</div>

      {/* Table */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <TableWrap>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.4fr 1fr 0.9fr 1fr 1fr 1fr 1fr 0.9fr 0.9fr", gap: 0, padding: "10px 16px", background: C.bg, fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
            <div style={{ cursor: "pointer" }} onClick={() => toggleSort("name")}>Distributeur{sortIcon("name")}</div>
            <div>Nom</div>
            <div>Type</div>
            <div>Ville</div>
            <div>Opérateur</div>
            <div style={{ cursor: "pointer" }} onClick={() => toggleSort("sims_sold")}>SIMs vendues{sortIcon("sims_sold")}</div>
            <div style={{ cursor: "pointer" }} onClick={() => toggleSort("fraud_sims")}>SIMs fraude{sortIcon("fraud_sims")}</div>
            <div style={{ cursor: "pointer" }} onClick={() => toggleSort("fraud_rate")}>Taux fraude %{sortIcon("fraud_rate")}</div>
            <div style={{ cursor: "pointer" }} onClick={() => toggleSort("risk_score")}>Score{sortIcon("risk_score")}</div>
            <div>Actions</div>
          </div>

          {loading ? (
            <EmptyState icon="reports" text="Chargement des distributeurs…" />
          ) : filtered.length === 0 ? (
            <EmptyState icon="agents" text="Aucun distributeur trouvé" />
          ) : filtered.map((d) => {
            const risk = toRisk(d.risk_score || 0);
            const fraudPct = d.fraud_rate != null
              ? (d.fraud_rate * 100).toFixed(1)
              : ((d.fraud_sims || 0) / (d.sims_sold || 1) * 100).toFixed(1);
            const fraudColor = parseFloat(fraudPct) > 10 ? C.danger : parseFloat(fraudPct) > 5 ? C.warning : C.success;
            return (
              <div key={d.id}
                onClick={() => setSelectedDist(d)}
                style={{ display: "grid", gridTemplateColumns: "1.2fr 1.4fr 1fr 0.9fr 1fr 1fr 1fr 1fr 0.9fr 0.9fr", gap: 0, padding: "11px 16px", borderTop: `1px solid ${C.mutedL}`, alignItems: "center", fontSize: 12, cursor: "pointer", background: d.flagged ? C.danger + "05" : "none" }}
                onMouseOver={e => e.currentTarget.style.background = C.bg}
                onMouseOut={e => e.currentTarget.style.background = d.flagged ? C.danger + "05" : "none"}
              >
                <div>
                  <div style={{ fontFamily: "monospace", fontWeight: 700, color: C.navy, fontSize: 11 }}>{d.distributor_id || d.id}</div>
                  {d.flagged && <Badge label="Flagué" color={C.danger} small />}
                </div>
                <div style={{ color: C.textL }}>{d.name || "—"}</div>
                <div><Badge label={typeLabel(d.type)} color={typeColor(d.type)} small /></div>
                <div style={{ color: C.textL }}>{d.city || "—"}</div>
                <div style={{ color: C.muted, fontSize: 11 }}>{d.operator || "—"}</div>
                <div style={{ fontWeight: 600, color: C.navy }}>{fmtNum(d.sims_sold)}</div>
                <div style={{ fontWeight: 700, color: (d.fraud_sims || 0) > 0 ? C.danger : C.success }}>{fmtNum(d.fraud_sims)}</div>
                <div style={{ fontWeight: 800, color: fraudColor }}>{fraudPct}%</div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ flex: 1, height: 5, background: C.mutedL, borderRadius: 3, overflow: "hidden", maxWidth: 38 }}>
                      <div style={{ width: `${d.risk_score || 0}%`, height: "100%", background: riskColor(risk) }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: riskColor(risk) }}>{d.risk_score || 0}</span>
                  </div>
                </div>
                <div onClick={e => e.stopPropagation()}>
                  {(d.risk_score || 0) >= 60 || d.flagged ? (
                    <Btn small variant="danger" onClick={() => setSelectedDist(d)}>Voir</Btn>
                  ) : (
                    <Badge label="OK" color={C.success} small />
                  )}
                </div>
              </div>
            );
          })}
        </TableWrap>
      </Card>

      {/* Detail Panel */}
      {selectedDist && (
        <>
          <div onClick={() => setSelectedDist(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 999 }} />
          <DistributorPanel dist={selectedDist} onClose={() => setSelectedDist(null)} onFlag={handleFlag} />
        </>
      )}
    </div>
  );
}
