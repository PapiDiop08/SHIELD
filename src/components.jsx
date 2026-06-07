import { C, ROLES } from "./theme.js";

export function Badge({ label, color, small }) {
  return (
    <span style={{ background: color + "18", color, border: `1px solid ${color}33`, fontSize: small ? 9 : 10, fontWeight: 700, padding: small ? "2px 7px" : "3px 9px", borderRadius: 20, whiteSpace: "nowrap", display: "inline-block" }}>{label}</span>
  );
}

export function Btn({ children, onClick, variant = "primary", small, style, disabled }) {
  const styles = {
    primary: { background: C.red, color: C.white, border: "none" },
    secondary: { background: C.white, color: C.navy, border: `1px solid ${C.mutedL}` },
    navy: { background: C.navy, color: C.white, border: "none" },
    ghost: { background: "none", color: C.textL, border: `1px solid ${C.mutedL}` },
    success: { background: C.successL, color: C.success, border: `1px solid ${C.success}44` },
    danger: { background: C.dangerL, color: C.danger, border: `1px solid ${C.danger}44` },
    warning: { background: C.warningL, color: C.warning, border: `1px solid ${C.warning}44` },
    purple: { background: C.purpleL, color: C.purple, border: `1px solid ${C.purple}44` },
    sky: { background: C.skyL, color: C.sky, border: `1px solid ${C.sky}44` },
    teal: { background: C.tealL, color: C.teal, border: `1px solid ${C.teal}44` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...styles[variant], borderRadius: 8, padding: small ? "5px 11px" : "9px 18px", fontSize: small ? 11 : 13, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 6, opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap", flexShrink: 0, ...style }}
      onMouseOver={e => !disabled && (e.currentTarget.style.opacity = "0.82")}
      onMouseOut={e => !disabled && (e.currentTarget.style.opacity = "1")}
    >{children}</button>
  );
}

export function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{ background: C.white, border: `1px solid ${C.mutedL}`, borderRadius: 12, boxShadow: "0 1px 4px rgba(13,27,62,0.06)", cursor: onClick ? "pointer" : "default", ...style }}
      onMouseOver={onClick ? e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(13,27,62,0.12)" : undefined}
      onMouseOut={onClick ? e => e.currentTarget.style.boxShadow = "0 1px 4px rgba(13,27,62,0.06)" : undefined}
    >{children}</div>
  );
}

export function Stat({ value, label, color, sub, icon }) {
  return (
    <Card style={{ padding: "16px 18px", flex: 1, minWidth: 120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: color || C.navy, lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: C.success, marginTop: 3, fontWeight: 600 }}>{sub}</div>}
          <div style={{ fontSize: 11, color: C.textL, marginTop: 6 }}>{label}</div>
        </div>
        {icon && <div style={{ fontSize: 18, opacity: 0.4 }}>{icon}</div>}
      </div>
    </Card>
  );
}

export function Avatar({ user, size = 32 }) {
  const colors = [C.red, C.sky, C.purple, C.teal, C.warning, C.navy];
  const color = colors[(user?.name || "").charCodeAt(0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: color + "22", border: `2px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 800, color, flexShrink: 0 }}>
      {user?.avatar || "?"}
    </div>
  );
}

export function Modal({ title, children, onClose, width = 560 }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(13,27,62,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: width, maxHeight: "94vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.2)" }}>
        {title && (
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.mutedL}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: C.white, zIndex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.navy }}>{title}</h2>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.muted, lineHeight: 1 }}>×</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function SectionHeader({ title, sub, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: C.navy }}>{title}</h1>
        {sub && <p style={{ margin: "4px 0 0", color: C.textL, fontSize: 12 }}>{sub}</p>}
      </div>
      {action && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

export function EmptyState({ icon, text }) {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center", color: C.muted }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <p style={{ margin: 0, fontSize: 14 }}>{text}</p>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Rechercher..." }) {
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 13 }}>🔍</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "8px 10px 8px 30px", fontSize: 12, color: C.navy, outline: "none", boxSizing: "border-box", background: C.white }} />
    </div>
  );
}

export function Select({ value, onChange, options, style }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: C.navy, background: C.white, outline: "none", cursor: "pointer", flexShrink: 0, ...style }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function RoleBadge({ role }) {
  const r = ROLES[role];
  if (!r) return null;
  return <Badge label={`${r.icon} ${r.label}`} color={r.color} small />;
}

// ── TABLE WRAPPER — scrollable horizontally ───────────────────────────────
export function TableWrap({ children }) {
  return (
    <div style={{ overflowX: "auto", width: "100%", WebkitOverflowScrolling: "touch" }}>
      <div style={{ minWidth: 700 }}>
        {children}
      </div>
    </div>
  );
}

// ── CONFIRM DIALOG ────────────────────────────────────────────────────────
export function ConfirmModal({ title, message, confirmLabel, confirmColor = C.danger, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel} width={420}>
      <div style={{ padding: "20px 24px" }}>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: C.textL, lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={onCancel} style={{ flex: 1, justifyContent: "center" }}>Annuler</Btn>
          <Btn onClick={onConfirm} style={{ flex: 2, justifyContent: "center", background: confirmColor, border: "none", color: C.white }}>
            {confirmLabel || "Confirmer"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}