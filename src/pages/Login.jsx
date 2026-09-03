// ── AAR Telco — Connexion ─────────────────────────────────────────────────
import { useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { C } from "../theme.js";

function Logo({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <path d="M100 12 L182 52 L182 118 Q182 166 100 188 Q18 166 18 118 L18 52 Z" fill={C.orange} opacity="0.95" />
      <path d="M100 12 L182 52 L182 82 Q142 60 100 12 Z" fill={C.gold} opacity="0.9" />
      <text x="100" y="132" textAnchor="middle" fontSize="62" fontWeight="900" fill="white" fontFamily="Arial">T</text>
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleLogin(e) {
    e?.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");
    const result = await login(email, password);
    if (!result.success) { setError(result.error || "Email ou mot de passe incorrect"); setLoading(false); }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(1200px 600px at 50% -10%, ${C.navyB} 0%, ${C.navy} 55%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans','Segoe UI',sans-serif", padding: 24,
    }}>
      <div style={{ display: "flex", gap: 40, alignItems: "flex-start", width: "100%", maxWidth: 920 }}>

        {/* Left — branding */}
        <div style={{ flex: 1, paddingTop: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 30 }}>
            <Logo size={48} />
            <div>
              <div style={{ fontWeight: 900, fontSize: 22, color: C.white, letterSpacing: 1 }}>AAR Telco</div>
              <div style={{ fontSize: 11, color: C.muted }}>by AAR — Africa Anti-fraud &amp; Risk</div>
            </div>
          </div>
          <h1 style={{ margin: "0 0 16px", fontSize: 34, fontWeight: 900, color: C.white, lineHeight: 1.2 }}>
            Protégez vos revenus<br />
            <span style={{ color: C.orange }}>télécom.</span>
          </h1>
          <p style={{ margin: "0 0 32px", fontSize: 15, color: C.muted, lineHeight: 1.6 }}>
            Plateforme de détection de fraude télécom pour les opérateurs africains — SIM Box, IRSF, Wangiri, bypass GSM, anomalies CDR.
          </p>
          {[
            { label: "40+ règles CDR préconfigurées — détection temps réel" },
            { label: "Analyse antennes BTS & mouvements cellulaires" },
            { label: "Détection SIM Box, IRSF, Wangiri, spoofing CLI" },
            { label: "Profil SIM 360° — CDR voix, SMS, SIM swap" },
            { label: "Export CSV — blocage & blacklist automatiques" },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.orange, flexShrink: 0, display: "inline-block" }} />
              <span style={{ fontSize: 13, color: C.muted }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Right — form */}
        <div style={{ width: 380, flexShrink: 0 }}>
          <div style={{ background: C.white, borderRadius: 16, padding: "32px", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 900, color: C.navy }}>Connexion</h2>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: C.textL }}>Accédez à votre espace AAR Telco</p>

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.com" required
                  style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "10px 14px", fontSize: 14, color: C.navy, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Mot de passe</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "10px 14px", fontSize: 14, color: C.navy, outline: "none", boxSizing: "border-box" }} />
              </div>

              {error && (
                <div style={{ background: C.dangerL, border: `1px solid ${C.danger}44`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: C.danger, fontWeight: 600 }}>
                  ! {error}
                </div>
              )}

              <button type="submit" disabled={loading || !email || !password}
                style={{ width: "100%", background: loading || !email || !password ? C.muted : C.orange, color: C.white, border: "none", borderRadius: 8, padding: "12px", fontWeight: 800, fontSize: 15, cursor: loading || !email || !password ? "not-allowed" : "pointer" }}>
                {loading ? "Connexion..." : "Se connecter →"}
              </button>
            </form>

          </div>
          <p style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: C.muted }}>
            © 2026 AAR — Africa Anti-fraud &amp; Risk — CONFIDENTIEL
          </p>
        </div>
      </div>
    </div>
  );
}
