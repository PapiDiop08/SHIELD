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
      { key: "dashboard", label: "Dashboard",         icon: "dashboard" },
      { key: "alerts",    label: "Alertes",           icon: "alerts",    badge: criticalAlerts },
      { key: "cases",     label: "Mes Cases",          icon: "cases",     badge: myAlerts },
      { key: "blockings", label: "Actions Blocage",   icon: "blockings" },
    ]},
    { label: "Détection", items: [
      { key: "rules",          label: "Règles de détection",  icon: "rules" },
      { key: "blacklist",      label: "Whitelist / Blacklist", icon: "blacklist" },
      { key: "cells",          label: "Réseau Antennes",       icon: "operators" },
      { key: "complaints",     label: "Plaintes",              icon: "complaints" },
      { key: "distributors",   label: "Distributeurs SIM",     icon: "agents" },
      { key: "sim_management", label: "Gestion SIM",           icon: "agents" },
      { key: "simulator",      label: "Simulateur CDR",        icon: "ai" },
    ]},
    { label: "Analytique", items: [
      { key: "reports",      label: "Reporting",         icon: "reports" },
      { key: "financial",    label: "Rapport financier", icon: "scoring" },
      { key: "rules_review", label: "Perf. Règles",      icon: "scoring" },
      { key: "logs",         label: "Journal d'audit",   icon: "logs" },
    ]},
    { label: "Admin", show: can("manageUsers") || can("manageUDF") || can("manageSettings") || isGFM(), items: [
      ...(can("manageUsers") ? [{ key: "admin",     label: "Utilisateurs",     icon: "admin" }] : []),
      ...(isGFM()            ? [{ key: "operators", label: "Banques Clientes", icon: "operators" }] : []),
      ...(isGFM()            ? [{ key: "billing",   label: "Facturation",      icon: "billing" }] : []),
      ...(can("manageUDF")   ? [{ key: "udf",       label: "Champs CDR",       icon: "udf" }] : []),
      ...(can("manageSettings") ? [{ key: "settings", label: "Paramètres système", icon: "settings" }] : []),
    ].filter(Boolean)},
  ];

  // Sidebar gradient — identique GFM (#0A0B0D → #282B31)
  const sidebarGradient = "linear-gradient(180deg, #0A0B0D 0%, #282B31 100%)";
  const SIDEBAR_W = 225;

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif", display: "flex", minHeight: "100vh", background: "#F3F4F6", color: C.text }}>

      {/* Sidebar — gradient charcoal GFM */}
      <div style={{ width: SIDEBAR_W, background: sidebarGradient, display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh" }}>

        {/* Logo + branding */}
        <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <svg width="36" height="36" viewBox="0 0 200 200" style={{ flexShrink: 0 }}>
              <path d="M100 10 L180 50 L180 120 Q180 165 100 190 Q20 165 20 120 L20 50 Z" fill={C.blue} opacity="0.95"/>
              <path d="M100 10 L180 50 L180 80 Q140 60 100 10 Z" fill="#60A5FA" opacity="0.85"/>
              <text x="100" y="130" textAnchor="middle" fontSize="58" fontWeight="900" fill="white" fontFamily="Arial">T</text>
            </svg>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#F8FAFC", letterSpacing: 0.5 }}>AAR Telco</div>
              <div style={{ fontSize: 10, color: "#94A3B8" }}>Fraud Detection Platform</div>
            </div>
          </div>

          {/* User card */}
          <div onClick={onProfileClick}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 10px", cursor: "pointer", border: "1px solid rgba(255,255,255,0.08)" }}
            onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
            onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}>
            <Avatar user={currentUser} size={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#F1F5F9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser?.name}</div>
              <div style={{ fontSize: 10, color: role?.color || "#64748B" }}>{role?.label}</div>
            </div>
            <Icon name="edit" size={12} color="#64748B" />
          </div>
        </div>

        {/* My alerts banner */}
        {myAlerts > 0 && (
          <div onClick={() => setPage("alerts")}
            style={{ margin: "8px 8px 0", background: `${C.warning}18`, border: `1px solid ${C.warning}40`, borderRadius: 8, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
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
              <div key={si} style={{ marginBottom: 4 }}>
                {section.label && (
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", padding: "8px 12px 3px" }}>
                    {section.label}
                  </div>
                )}
                {items.map(item => {
                  const active = page === item.key;
                  return (
                    <button key={item.key} onClick={() => setPage(item.key)}
                      style={{
                        display: "flex", alignItems: "center", gap: 9, width: "100%",
                        background: active ? C.blue : "transparent",
                        border: "none", borderRadius: 8,
                        padding: "8px 12px", marginBottom: 1,
                        color: active ? "#FFFFFF" : "#94A3B8",
                        cursor: "pointer", fontSize: 12,
                        fontWeight: active ? 600 : 400,
                        fontFamily: "'Inter', system-ui, sans-serif",
                        textAlign: "left",
                        transition: "all 0.15s",
                      }}
                      onMouseOver={e => !active && (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
                      onMouseOut={e => !active && (e.currentTarget.style.background = "transparent")}>
                      <span style={{ width: 17, flexShrink: 0, display: "flex", alignItems: "center" }}>
                        <Icon name={item.icon} size={14} color={active ? "#FFFFFF" : "#64748B"} />
                      </span>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.badge && typeof item.badge === "number" && item.badge > 0 && (
                        <span style={{ background: C.red, color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 10, minWidth: 16, textAlign: "center" }}>{item.badge > 99 ? "99+" : item.badge}</span>
                      )}
                      {item.badge && typeof item.badge === "string" && (
                        <span style={{ background: C.purple, color: "#fff", fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 6 }}>{item.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <button
            onClick={() => window.open("http://localhost:5173", "_blank")}
            style={{ width: "100%", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#94A3B8", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 7, marginBottom: 6, fontFamily: "inherit" }}
            onMouseOver={e => { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.color = C.blue; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#94A3B8"; }}>
            <Icon name="switch" size={13} color="currentColor" /> AAR Mobile Money
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ position: "relative", display: "inline-flex" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.success, display: "block" }} />
              <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: C.success, opacity: 0.4, animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite" }} />
            </span>
            <span style={{ fontSize: 10, color: C.success, fontWeight: 600 }}>Système actif</span>
          </div>
          <button onClick={logout}
            style={{ width: "100%", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#94A3B8", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit" }}
            onMouseOver={e => { e.currentTarget.style.borderColor = C.danger; e.currentTarget.style.color = C.danger; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#94A3B8"; }}>
            <Icon name="logout" size={13} color="currentColor" /> Déconnexion
          </button>
        </div>
      </div>

      {/* Contenu principal */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", overflowX: "hidden", minWidth: 0 }}>

        {/* Top header — blanc, border-bottom, identique GFM */}
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: C.muted }}>
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Mode badge */}
            <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", border: "1px solid #CBD5E1", borderRadius: 8, padding: "4px 10px" }}>
              MODE SUPERVISION
            </span>
            {/* Alerts bell */}
            <div style={{ position: "relative", cursor: "pointer" }} onClick={() => setPage("alerts")}>
              <Icon name="alerts" size={18} color={criticalAlerts > 0 ? C.red : C.muted} />
              {criticalAlerts > 0 && (
                <span style={{ position: "absolute", top: -4, right: -4, background: C.red, color: "#fff", fontSize: 8, fontWeight: 700, minWidth: 14, height: 14, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 2px" }}>
                  {criticalAlerts > 99 ? "99+" : criticalAlerts}
                </span>
              )}
            </div>
            {/* User avatar */}
            <div onClick={onProfileClick} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar user={currentUser} size={30} />
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{currentUser?.name}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{role?.label} · <span style={{ color: C.blue, fontWeight: 600 }}>GLOBAL</span></div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: "0", minWidth: 1100 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
