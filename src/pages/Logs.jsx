// ── SHIELD Logs Page — FULL LINK ─────────────────────────────────────────────
// Données depuis audit_logs Supabase — plus de MOCK_LOGS

import { useState, useMemo, useEffect, useCallback } from "react";
import { C } from "../theme.js";
import { Card, Badge, SectionHeader, SearchInput, Select } from "../components.jsx";
import { useAuth } from "../AuthContext.jsx";
import { supabase } from "../supabase.js";

const ACTION_COLORS = {
  LOGIN: C.success, LOGOUT: C.muted,
  CREATE_RULE: C.sky, EDIT_RULE: C.warning, TOGGLE_RULE: C.warning,
  BLOCK_SIM: C.danger, BLOCK_SIM_MANUAL: C.danger, ADD_BLACKLIST: C.danger,
  UNBLOCK_SIM: C.success,
  IMPORT_BATCH: C.purple, ASSIGN_ALERT: C.sky,
  UPDATE_ALERT_STATUS: C.warning, UPDATE_CASE_STATUS: C.warning,
  CREATE_CASE: C.purple, CREATE_USER: C.sky,
  TOGGLE_USER: C.warning, CHANGE_ROLE: C.purple,
  RESET_PASSWORD: C.warning, CHANGE_PASSWORD: C.warning,
  VIEW_PAGE: C.muted, ADD_NOTE: C.sky,
  WATCHLIST_ADD: C.warning,
  AI_ANALYSIS_START: C.purple, AI_ANALYSIS_DONE: C.purple,
  GROUP_ACTION_BLOCK: C.danger, GROUP_ACTION_BLACKLIST: C.danger,
  BLACKLIST_CELL: C.danger,
};

const ACTION_ICONS = {
  LOGIN: "🔐", LOGOUT: "⎋",
  CREATE_RULE: "⚙", EDIT_RULE: "✏",
  BLOCK_SIM: "🚫", BLOCK_SIM_MANUAL: "🚫", UNBLOCK_SIM: "✅",
  ADD_BLACKLIST: "📋", ASSIGN_ALERT: "👤",
  CREATE_CASE: "📁", CREATE_USER: "👤",
  CHANGE_ROLE: "🛡", RESET_PASSWORD: "🔑", CHANGE_PASSWORD: "🔑",
  VIEW_PAGE: "👁", ADD_NOTE: "📝",
  AI_ANALYSIS_START: "🧠", AI_ANALYSIS_DONE: "✅",
  BLACKLIST_CELL: "📡",
};

// ── Hook : audit_logs depuis Supabase ────────────────────────────────────
function useAuditLogs() {
  const [dbLogs, setDbLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      // Normaliser vers le format attendu par le composant
      setDbLogs((data || []).map(l => ({
        id: l.id,
        ts: l.created_at?.replace("T", " ").slice(0, 19) || "—",
        userId: l.user_id || null,
        userName: l.user_name || "—",
        userRole: l.user_role || "—",
        action: l.action || "—",
        entity: l.entity || "—",
        entityId: l.entity_id || null,
        detail: l.detail || "—",
        page: l.page || "—",
        ip: l.ip_address || "—",
      })));
    } catch (err) {
      console.error("useAuditLogs error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime
  useEffect(() => {
    const sub = supabase.channel("audit-logs-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_logs" }, fetch)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [fetch]);

  return { dbLogs, loading, refetch: fetch };
}

export default function Logs({ logs: liveLogs, addLog, users }) {
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterUser, setFilterUser] = useState("all");

  const { dbLogs, loading, refetch } = useAuditLogs();

  // Fusionner logs Supabase + logs session live (sans doublons)
  const allLogs = useMemo(() => {
    const combined = [...dbLogs, ...(liveLogs || [])];
    const seen = new Set();
    return combined
      .filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true; })
      .sort((a, b) => b.ts.localeCompare(a.ts));
  }, [dbLogs, liveLogs]);

  const filtered = useMemo(() => {
    let list = allLogs;
    if (search) list = list.filter(l =>
      l.detail?.toLowerCase().includes(search.toLowerCase()) ||
      l.action?.toLowerCase().includes(search.toLowerCase()) ||
      l.userName?.toLowerCase().includes(search.toLowerCase())
    );
    if (filterAction !== "all") list = list.filter(l => l.action === filterAction);
    if (filterUser !== "all") list = list.filter(l => l.userId === filterUser);
    return list;
  }, [allLogs, search, filterAction, filterUser]);

  const actions = [...new Set(allLogs.map(l => l.action))].sort();

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = allLogs.filter(l => l.ts.startsWith(today)).length;
  const criticalCount = allLogs.filter(l =>
    ["BLOCK_SIM", "ADD_BLACKLIST", "RESET_PASSWORD", "BLACKLIST_CELL", "GROUP_ACTION_BLOCK"].includes(l.action)
  ).length;
  const loginCount = allLogs.filter(l => l.action === "LOGIN").length;

  return (
    <div style={{ padding: "24px 20px", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <SectionHeader
        title="Audit Log"
        sub={loading ? "Chargement depuis Supabase…" : `${allLogs.length} événements · Registre Supabase + session`}
        action={
          <button onClick={refetch}
            style={{ background: "none", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "6px 14px", color: C.muted, cursor: "pointer", fontSize: 12 }}>
            🔄 Actualiser
          </button>
        }
      />

      {/* Bannière sécurité */}
      <div style={{ background: C.navyL, border: `1px solid ${C.navyB}`, borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <span>🔒</span>
        <span style={{ fontSize: 12, color: C.white, fontWeight: 600 }}>
          Toutes les actions sont enregistrées automatiquement dans Supabase — Non modifiable, non supprimable
        </span>
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <Card style={{ flex: 1, minWidth: 100, padding: "12px 16px" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.navy }}>{loading ? "…" : allLogs.length}</div>
          <div style={{ fontSize: 11, color: C.textL }}>Total</div>
        </Card>
        <Card style={{ flex: 1, minWidth: 100, padding: "12px 16px" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.sky }}>{loading ? "…" : todayCount}</div>
          <div style={{ fontSize: 11, color: C.textL }}>Aujourd'hui</div>
        </Card>
        <Card style={{ flex: 1, minWidth: 100, padding: "12px 16px" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.danger }}>{loading ? "…" : criticalCount}</div>
          <div style={{ fontSize: 11, color: C.textL }}>Actions critiques</div>
        </Card>
        <Card style={{ flex: 1, minWidth: 100, padding: "12px 16px" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.success }}>{loading ? "…" : loginCount}</div>
          <div style={{ fontSize: 11, color: C.textL }}>Connexions</div>
        </Card>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher dans les logs..." />
        <Select
          value={filterAction}
          onChange={setFilterAction}
          options={[{ value: "all", label: "Toutes actions" }, ...actions.map(a => ({ value: a, label: `${ACTION_ICONS[a] || "•"} ${a}` }))]}
        />
        <Select
          value={filterUser}
          onChange={setFilterUser}
          options={[{ value: "all", label: "Tous utilisateurs" }, ...(users || []).map(u => ({ value: u.id, label: u.name }))]}
        />
        {(search || filterAction !== "all" || filterUser !== "all") && (
          <button onClick={() => { setSearch(""); setFilterAction("all"); setFilterUser("all"); }}
            style={{ background: "none", border: "none", color: C.danger, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
            ✕ Effacer
          </button>
        )}
      </div>

      <div style={{ fontSize: 12, color: C.textL, marginBottom: 8 }}>
        {filtered.length} événement{filtered.length > 1 ? "s" : ""}
      </div>

      <Card style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `2px solid ${C.mutedL}` }}>
                {["Timestamp", "Type", "Action", "Utilisateur", "Détail", "Page"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: C.muted }}>
                    ⏳ Chargement depuis Supabase…
                  </td>
                </tr>
              )}
              {!loading && filtered.slice(0, 200).map((log, idx) => {
                const color = ACTION_COLORS[log.action] || C.muted;
                const icon  = ACTION_ICONS[log.action]  || "•";
                return (
                  <tr key={log.id}
                    style={{ borderBottom: `1px solid ${C.mutedL}`, background: idx % 2 === 0 ? C.white : "#FAFBFE" }}
                    onMouseOver={e => e.currentTarget.style.background = C.bg}
                    onMouseOut={e  => e.currentTarget.style.background = idx % 2 === 0 ? C.white : "#FAFBFE"}
                  >
                    <td style={{ padding: "9px 12px", fontFamily: "monospace", fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>
                      {log.ts}
                    </td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                      <span style={{ background: color + "18", color, borderRadius: 6, padding: "2px 6px", fontSize: 10, fontWeight: 700 }}>
                        {icon}
                      </span>
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <Badge label={(log.action || "").replace(/_/g, " ")} color={color} small />
                    </td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>{log.userName || "—"}</div>
                      {log.ip && <div style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>{log.ip}</div>}
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: 12, color: C.textL, maxWidth: 300 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.detail}</div>
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{log.page}</td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: C.muted }}>
                    Aucun événement trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {filtered.length > 200 && (
        <p style={{ textAlign: "center", color: C.muted, fontSize: 12, marginTop: 10 }}>
          200 premiers résultats affichés — affinez vos filtres
        </p>
      )}
    </div>
  );
}