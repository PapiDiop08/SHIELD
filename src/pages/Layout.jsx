import { C, ROLES, GFM_ROLES } from "../theme.js";
import { useAuth } from "../AuthContext.jsx";
import { Avatar, Badge } from "../components.jsx";
import { Icon } from "../icons.jsx";

export default function Layout({ page, setPage, children, alerts, cases, onProfileClick }) {
  const { currentUser, logout, can, isGFM } = useAuth();
  const role = ROLES[currentUser?.role];
  const criticalAlerts = alerts?.filter(a => a.severity === "critical" && !["cleared","closed","false_positive"].includes(a.status)).length || 0;
  const openCases = cases?.filter(c => c.status === "open" || c.status === "investigating").length || 0;
  const myAlerts = alerts?.filter(a => a.assignedTo === currentUser?.id && !["cleared","closed"].includes(a.status)).length || 0;

  const navSections = [
    { label: null, items: [
      { key: "dashboard", label: "Dashboard",   icon: "dashboard" },
      { key: "alerts",    label: "Détections",  icon: "alerts",    badge: criticalAlerts },
      { key: "cases",     label: "Cases",        icon: "cases",     badge: openCases },
      { key: "blockings", label: "Blocages",     icon: "blockings" },
    ]},
    { label: "Détection", items: [
      { key: "rules",      label: "Règles",    icon: "rules" },
      { key: "blacklist",  label: "Listes",    icon: "blacklist" },
      { key: "cells",         label: "Antennes",         icon: "operators" },
      { key: "complaints",    label: "Plaintes",         icon: "complaints" },
      { key: "distributors",  label: "Distributeurs SIM", icon: "agents" },
      { key: "sim_management", label: "Gestion SIM",       icon: "agents" },
      { key: "simulator",     label: "Simulateur CDR",    icon: "ai" },
    ]},
    { label: "Analyse", items: [
      { key: "reports",      label: "Rapports",      icon: "reports" },
      { key: "financial",    label: "Rapport financier", icon: "scoring" },
      { key: "rules_review", label: "Perf. Règles",  icon: "scoring" },
      { key: "logs",         label: "Audit Log",     icon: "logs" },
    ]},
    { label: "Admin", show: can("manageUsers") || can("manageUDF") || can("manageSettings") || isGFM(), items: [
      ...(can("manageUsers") ? [{ key: "admin",     label: "Utilisateurs", icon: "admin" }] : []),
      ...(isGFM()            ? [{ key: "operators", label: "Opérateurs",   icon: "operators" }] : []),
      ...(isGFM()            ? [{ key: "billing",   label: "Facturation",  icon: "billing" }] : []),
      ...(can("manageUDF")   ? [{ key: "udf",       label: "Champs CDR",   icon: "udf" }] : []),
      ...(can("manageSettings") ? [{ key: "settings", label: "Paramètres", icon: "settings" }] : []),
    ].filter(Boolean)},
  ];

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", display: "flex", minHeight: "100vh", background: C.bg, color: C.text }}>
      {/* Sidebar */}
      <div style={{ width: 225, background: C.navy, display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh" }}>

        {/* Logo + branding */}
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #1e3060" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <svg width="38" height="38" viewBox="0 0 200 200" style={{ flexShrink: 0 }}>
              <path d="M100 10 L180 50 L180 120 Q180 165 100 190 Q20 165 20 120 L20 50 Z" fill={C.red} opacity="0.9"/>
              <path d="M100 10 L180 50 L180 80 Q140 60 100 10 Z" fill={C.sky} opacity="0.85"/>
              <text x="100" y="130" textAnchor="middle" fontSize="58" fontWeight="900" fill="white" fontFamily="Arial">T</text>
            </svg>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15, color: C.white, letterSpacing: 1 }}>AAR Telco</div>
              <div style={{ fontSize: 9, color: C.muted }}>Fraud Detection Platform</div>
            </div>
          </div>

          {/* User card */}
          <div onClick={onProfileClick}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "#0a1530", borderRadius: 8, padding: "8px 10px", cursor: "pointer" }}
            onMouseOver={e => e.currentTarget.style.background = "#0f2040"}
            onMouseOut={e => e.currentTarget.style.background = "#0a1530"}>
            <Avatar user={currentUser} size={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser?.name}</div>
              <div style={{ fontSize: 9, color: role?.color || C.muted }}>{role?.label}</div>
            </div>
            <Icon name="edit" size={12} color={C.muted} />
          </div>
        </div>

        {/* My alerts banner */}
        {myAlerts > 0 && (
          <div onClick={() => setPage("alerts")}
            style={{ margin: "8px 8px 0", background: `${C.warning}18`, border: `1px solid ${C.warning}44`, borderRadius: 8, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="alerts" size={13} color={C.warning} />
            <span style={{ fontSize: 11, color: C.warning, fontWeight: 700 }}>{myAlerts} détection{myAlerts > 1 ? "s" : ""} à traiter</span>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: "8px 8px", overflowY: "auto" }}>
          {navSections.map((section, si) => {
            if (section.show === false) return null;
            const items = section.items.filter(Boolean);
            if (items.length === 0) return null;
            return (
              <div key={si} style={{ marginBottom: 6 }}>
                {section.label && (
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1, padding: "6px 12px 3px" }}>
                    {section.label}
                  </div>
                )}
                {items.map(item => {
                  const active = page === item.key;
                  return (
                    <button key={item.key} onClick={() => setPage(item.key)}
                      style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", background: active ? "#1e3060" : "none", border: "none", borderRadius: 8, padding: "8px 12px", marginBottom: 1, color: active ? C.white : C.muted, cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 400, textAlign: "left" }}
                      onMouseOver={e => !active && (e.currentTarget.style.background = "#0f2040")}
                      onMouseOut={e => !active && (e.currentTarget.style.background = "none")}>
                      <span style={{ width: 17, flexShrink: 0, display: "flex", alignItems: "center" }}>
                        <Icon name={item.icon} size={14} color={active ? C.white : C.muted} />
                      </span>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.badge && typeof item.badge === "number" && item.badge > 0 && (
                        <span style={{ background: C.red, color: C.white, fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 10 }}>{item.badge}</span>
                      )}
                      {item.badge && typeof item.badge === "string" && (
                        <span style={{ background: C.purple, color: C.white, fontSize: 8, fontWeight: 800, padding: "1px 5px", borderRadius: 6 }}>{item.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "10px 12px", borderTop: "1px solid #1e3060" }}>
          {/* Lien vers AAR Mobile Money */}
          <button
            onClick={() => window.open("http://localhost:5173", "_blank")}
            style={{ width: "100%", background: "none", border: "1px solid #1e3060", color: C.muted, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}
            onMouseOver={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = "#1e3060"; e.currentTarget.style.color = C.muted; }}>
            <Icon name="switch" size={13} color="currentColor" /> AAR Mobile Money
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.success, boxShadow: `0 0 6px ${C.success}` }} />
            <span style={{ fontSize: 10, color: C.success, fontWeight: 600 }}>Système actif</span>
          </div>
          <button onClick={logout}
            style={{ width: "100%", background: "none", border: "1px solid #1e3060", color: C.muted, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 7 }}
            onMouseOver={e => { e.currentTarget.style.borderColor = C.danger; e.currentTarget.style.color = C.danger; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = "#1e3060"; e.currentTarget.style.color = C.muted; }}>
            <Icon name="logout" size={13} color="currentColor" /> Déconnexion
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "auto", minWidth: 0 }}>
        <div style={{ minWidth: 1100 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
