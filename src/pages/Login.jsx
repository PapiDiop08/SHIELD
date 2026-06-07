// ── SHIELD Login Page ─────────────────────────────────────────────────────

import { useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { C, ROLES } from "../theme.js";
import { MOCK_USERS } from "../mockData.js";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTimeout(() => {
      const result = login(email);
      if (!result.success) {
        setError(result.error);
        setLoading(false);
      }
    }, 600);
  }

  function quickLogin(user) {
    login(user.email);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans','Segoe UI',sans-serif", padding: 24 }}>
      <div style={{ display: "flex", gap: 40, alignItems: "flex-start", width: "100%", maxWidth: 900 }}>
        <div style={{ flex: 1, paddingTop: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
            <div style={{ width: 48, height: 48, background: C.red, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 24, color: C.white }}>S</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 22, color: C.white, letterSpacing: 1 }}>SHIELD</div>
              <div style={{ fontSize: 11, color: C.muted }}>Fraud Detection Platform</div>
            </div>
          </div>
          <h1 style={{ margin: "0 0 16px", fontSize: 36, fontWeight: 900, color: C.white, lineHeight: 1.2 }}>
            Protégez vos revenus.<br />
            <span style={{ color: C.sky }}>Détectez la fraude.</span>
          </h1>
          <p style={{ margin: "0 0 32px", fontSize: 15, color: C.muted, lineHeight: 1.6 }}>
            Plateforme de détection et de gestion de la fraude télécom et Mobile Money pour les opérateurs africains.
          </p>
          {[{ icon: "⚙", label: "30+ règles préconfigurées" }, { icon: "🤖", label: "IA intégrée — analyse plaintes" }, { icon: "📡", label: "Détection anomalies antennes" }, { icon: "💸", label: "Couverture Mobile Money complète" }].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ fontSize: 13, color: C.muted }}>{item.label}</span>
            </div>
          ))}
        </div>

        <div style={{ width: 380, flexShrink: 0 }}>
          <div style={{ background: C.white, borderRadius: 16, padding: "32px", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 900, color: C.navy }}>Connexion</h2>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: C.textL }}>Accédez à votre espace SHIELD</p>

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" required
                  style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "10px 14px", fontSize: 14, color: C.navy, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Mot de passe</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                  style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "10px 14px", fontSize: 14, color: C.navy, outline: "none", boxSizing: "border-box" }} />
              </div>
              {error && <div style={{ background: C.dangerL, border: `1px solid ${C.danger}44`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: C.danger, fontWeight: 600 }}>⚠ {error}</div>}
              <button type="submit" disabled={loading} style={{ width: "100%", background: loading ? C.muted : C.red, color: C.white, border: "none", borderRadius: 8, padding: "12px", fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Connexion..." : "Se connecter →"}
              </button>
            </form>

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.mutedL}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 10 }}>Comptes de démonstration</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {MOCK_USERS.filter(u => u.active).slice(0, 4).map(user => {
                  const role = ROLES[user.role];
                  return (
                    <button key={user.id} onClick={() => quickLogin(user)} style={{ display: "flex", alignItems: "center", gap: 10, background: C.bg, border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer", textAlign: "left", width: "100%" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: (role?.color || C.muted) + "22", border: `1px solid ${(role?.color || C.muted)}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: role?.color || C.muted }}>
                        {user.avatar}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{user.name}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{role?.icon} {role?.label}</div>
                      </div>
                      <span style={{ fontSize: 11, color: C.sky }}>→</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <p style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: C.muted }}>© 2026 Global Fraud Management — CONFIDENTIEL</p>
        </div>
      </div>
    </div>
  );
}