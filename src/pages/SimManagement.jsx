// ── AAR Telco — Gestion SIM v1.0 ─────────────────────────────────────────────
// Vue globale multi-distributeur sur sim_profiles (vraies données AAR DB).

import { useState } from "react";
import { C } from "../theme.js";
import { Card, Badge, Btn, SectionHeader, SearchInput, Select, TableWrap, EmptyState } from "../components.jsx";
import { useSimProfilesSearch } from "../hooks/useSupabase.js";

const fmtNum = (n) => (n || 0).toLocaleString("fr-FR");

const toRisk = (score) => {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
};
const riskColor = (r) => ({ critical: C.danger, high: C.warning, medium: C.sky, low: C.success }[r] || C.muted);

const simStatusColor = (s) => s === "blocked" ? C.danger : s === "flagged" || s === "suspended" ? C.warning : s === "swapped" ? C.purple : C.success;
const simStatusLabel = (s) => ({
  blocked: "Bloquée", flagged: "Flaggée", suspended: "Suspendue", swapped: "Swap détecté", active: "Active",
}[s] || s || "—");

const STATUS_OPTIONS = [
  { value: "all", label: "Tous statuts" },
  { value: "active", label: "Actives" },
  { value: "flagged", label: "Flaggées" },
  { value: "suspended", label: "Suspendues" },
  { value: "swapped", label: "Swap détecté" },
  { value: "blocked", label: "Bloquées" },
];

const PAGE_SIZE = 50;

export default function SimManagement({ operators, currentOperator, operatorIdFilter, setSimProfile, addLog }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const { sims, distributorNames, total, loading, error, updating, updateStatus, bulkUpdateStatus, refetch } =
    useSimProfilesSearch({ search, status, operatorId: operatorIdFilter, page, pageSize: PAGE_SIZE });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allSelected = sims.length > 0 && selected.length === sims.length;

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleSelectAll() {
    setSelected(allSelected ? [] : sims.map(s => s.id));
  }

  async function applyBulk(newStatus) {
    if (selected.length === 0) return;
    setBulkBusy(true);
    const ok = await bulkUpdateStatus(selected, newStatus);
    if (ok) {
      addLog?.("BULK_UPDATE_SIM_STATUS", "sim_profiles", null, `${selected.length} SIM → ${newStatus}`, "SimManagement");
      setSelected([]);
    }
    setBulkBusy(false);
  }

  return (
    <div>
      <SectionHeader
        title="Gestion SIM"
        sub={`${fmtNum(total)} SIM au total — recherche et actions en masse, toutes agences confondues`}
      />

      {/* Stats rapides sur la page courante — indicatif, pas un total global */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ background: C.bg, borderRadius: 10, padding: "10px 16px" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.navy }}>{fmtNum(total)}</div>
          <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>Total SIM (base)</div>
        </div>
      </div>

      {/* Filtres */}
      <Card style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <SearchInput
            value={search}
            onChange={v => { setSearch(v); setPage(0); }}
            placeholder="MSISDN, ID SIM, IMSI, IMEI..."
          />
        </div>
        <Select
          value={status}
          onChange={v => { setStatus(v); setPage(0); }}
          options={STATUS_OPTIONS}
        />
        <Btn variant="ghost" small onClick={refetch}>Rafraîchir</Btn>
      </Card>

      {error && (
        <div style={{ padding: "10px 14px", marginBottom: 14, borderRadius: 10, background: C.danger + "15", color: C.danger, fontSize: 12, fontWeight: 600 }}>
          Erreur : {error}
        </div>
      )}

      {/* Actions de masse */}
      {selected.length > 0 && (
        <Card style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 12, background: C.navy, color: "#fff" }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{selected.length} SIM sélectionnée{selected.length > 1 ? "s" : ""}</div>
          <button
            disabled={bulkBusy}
            onClick={() => applyBulk("blocked")}
            style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: C.danger, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: bulkBusy ? 0.6 : 1 }}>
            {bulkBusy ? "…" : "Bloquer la sélection"}
          </button>
          <button
            disabled={bulkBusy}
            onClick={() => applyBulk("active")}
            style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: C.success, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: bulkBusy ? 0.6 : 1 }}>
            {bulkBusy ? "…" : "Débloquer la sélection"}
          </button>
          <button
            onClick={() => setSelected([])}
            style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Annuler
          </button>
        </Card>
      )}

      {/* Tableau */}
      <TableWrap>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.bg, textAlign: "left" }}>
              <th style={{ padding: "8px 10px", width: 30 }}>
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
              </th>
              <th style={{ padding: "8px 10px", fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase" }}>MSISDN</th>
              <th style={{ padding: "8px 10px", fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase" }}>Distributeur</th>
              <th style={{ padding: "8px 10px", fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase" }}>Statut</th>
              <th style={{ padding: "8px 10px", fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase" }}>Risque</th>
              <th style={{ padding: "8px 10px", fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase" }}>Appels 24h</th>
              <th style={{ padding: "8px 10px", fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase" }}>Swaps</th>
              <th style={{ padding: "8px 10px", fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase" }}>Activée</th>
              <th style={{ padding: "8px 10px", fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 30, textAlign: "center", color: C.muted, fontSize: 12 }}>Chargement…</td></tr>
            ) : sims.length === 0 ? (
              <tr><td colSpan={9}><EmptyState text="Aucune SIM ne correspond à ces critères" /></td></tr>
            ) : sims.map(sim => (
              <tr key={sim.id} style={{ borderTop: `1px solid ${C.mutedL}`, fontSize: 12 }}>
                <td style={{ padding: "9px 10px" }}>
                  <input type="checkbox" checked={selected.includes(sim.id)} onChange={() => toggleSelect(sim.id)} />
                </td>
                <td
                  style={{ padding: "9px 10px", cursor: "pointer" }}
                  onClick={() => setSimProfile && setSimProfile({ msisdn: sim.msisdn, score: sim.risk_score, fraudType: "Gestion SIM" })}
                >
                  <div style={{ fontFamily: "monospace", fontWeight: 700, color: C.navy, textDecoration: "underline", textDecorationColor: C.mutedL }}>{sim.msisdn}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>{sim.id}</div>
                </td>
                <td style={{ padding: "9px 10px", color: C.textL }}>
                  {distributorNames[sim.distributor_id] || (sim.distributor_id ? sim.distributor_id : "—")}
                </td>
                <td style={{ padding: "9px 10px" }}>
                  <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 6, background: simStatusColor(sim.status) + "20", color: simStatusColor(sim.status), fontSize: 10, fontWeight: 700 }}>
                    {simStatusLabel(sim.status)}
                  </span>
                </td>
                <td style={{ padding: "9px 10px", fontWeight: 700, color: riskColor(toRisk(sim.risk_score || 0)) }}>{sim.risk_score || 0}</td>
                <td style={{ padding: "9px 10px", color: C.textL }}>{fmtNum(sim.calls_24h)}</td>
                <td style={{ padding: "9px 10px", color: C.textL }}>{sim.swap_count || 0}</td>
                <td style={{ padding: "9px 10px", color: C.muted, fontSize: 10 }}>
                  {sim.activated_at ? new Date(sim.activated_at).toLocaleDateString("fr-FR") : "—"}
                </td>
                <td style={{ padding: "9px 10px" }}>
                  {sim.status === "blocked" ? (
                    <button
                      disabled={updating === sim.id}
                      onClick={() => updateStatus(sim.id, "active")}
                      style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: C.success + "20", color: C.success, fontSize: 10, fontWeight: 700, cursor: "pointer", opacity: updating === sim.id ? 0.6 : 1 }}>
                      {updating === sim.id ? "…" : "Débloquer"}
                    </button>
                  ) : (
                    <button
                      disabled={updating === sim.id}
                      onClick={() => updateStatus(sim.id, "blocked")}
                      style={{ padding: "3px 8px", borderRadius: 6, border: "none", background: C.danger + "20", color: C.danger, fontSize: 10, fontWeight: 700, cursor: "pointer", opacity: updating === sim.id ? 0.6 : 1 }}>
                      {updating === sim.id ? "…" : "Bloquer"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 14 }}>
          <button
            disabled={page === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.mutedL}`, background: "#fff", fontSize: 12, fontWeight: 700, cursor: page === 0 ? "default" : "pointer", opacity: page === 0 ? 0.4 : 1 }}>
            ← Précédent
          </button>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>Page {page + 1} / {totalPages}</div>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.mutedL}`, background: "#fff", fontSize: 12, fontWeight: 700, cursor: page >= totalPages - 1 ? "default" : "pointer", opacity: page >= totalPages - 1 ? 0.4 : 1 }}>
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}
