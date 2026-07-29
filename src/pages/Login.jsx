// ── AAR Telco — Login ──────────────────────────────────────────────────────
import { useState } from "react";
import { useAuth } from "../AuthContext.jsx";
import { C } from "../theme.js";
import { Icon } from "../icons.jsx";

const QUICK_ACCOUNTS = [
  { label: "Superadmin AAR",   email: "admin@aar-momo.com",    pwd: "AarAdmin2026!", color: "#E83A2E" },
  { label: "Admin — Partner",  email: "ibrahima@partner.sn",   pwd: "AarAdmin2026!", color: "#E8A020" },
  { label: "Analyste — AAR",   email: "aissatou@aar-momo.com", pwd: "AarAdmin2026!", color: "#7B5EA7" },
];

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
    const result = await login(email, null, password);
    if (!result.success) {
      setError(result.error || "Email ou mot de passe incorrect");
      setLoading(false);
    }
  }

  async function quickLogin(acc) {
    setLoading(true);
    setError("");
    const result = await login(acc.email, null, acc.pwd);
    if (!result.success) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: C.navy,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans','Segoe UI',sans-serif", padding: 24,
    }}>
      <div style={{ display: "flex", gap: 48, alignItems: "flex-start", width: "100%", maxWidth: 900 }}>

        {/* Left — branding */}
        <div style={{ flex: 1, paddingTop: 32 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
            <svg width="48" height="48" viewBox="0 0 200 200">
              <path d="M100 10 L180 50 L180 120 Q180 165 100 190 Q20 165 20 120 L20 50 Z" fill={C.red} opacity="0.9"/>
              <path d="M100 10 L180 50 L180 80 Q140 60 100 10 Z" fill={C.sky} opacity="0.85"/>
              <text x="100" y="130" textAnchor="middle" fontSize="58" fontWeight="900" fill="white" fontFamily="Arial">T</text>
            </svg>
            <div>
              <div style={{ fontWeight: 900, fontSize: 20, color: C.white, letterSpacing: 1 }}>AAR Telco</div>
              <div style={{ fontSize: 10, color: C.muted }}>by AAR — Africa Anti-fraud &amp; Risk</div>
            </div>
          </div>

          <h1 style={{ margin: "0 0 14px", fontSize: 32, fontWeight: 900, color: C.white, lineHeight: 1.2 }}>
            Protégez vos revenus<br/>
            <span style={{ color: C.sky }}>télécom.</span>
          </h1>
          <p style={{ margin: "0 0 28px", fontSize: 13, color: C.muted, lineHeight: 1.7, maxWidth: 380 }}>
            Plateforme de détection de fraude télécom — SIM Box, IRSF, Wangiri, bypass GSM, anomalies antennes et CDR voix/data.
          </p>

          {[
            { icon: "rules",     text: "40+ règles CDR préconfigurées" },
            { icon: "operators", text: "Analyse antennes BTS en temps réel" },
            { icon: "ai",        text: "IA intégrée — patterns & anomalies" },
            { icon: "alerts",    text: "Détection SIM Box, IRSF, Wangiri" },
            { icon: "reports",   text: "Export CSV — blocage automatique" },
          ].map(item => (
            <div key={item.text} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Icon name={item.icon} size={14} color={C.sky} />
              <span style={{ fontSize: 12, color: C.muted }}>{item.text}</span>
            </div>
          ))}
        </div>

        {/* Right — form */}
        <div style={{ width: 380, flexShrink: 0 }}>
          <div style={{ background: C.white, borderRadius: 16, padding: "32px", boxShadow: "0 24px 64px rgba(0,0,0,0.35)" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 900, color: C.navy }}>Connexion</h2>
            <p style={{ margin: "0 0 24px", fontSize: 12, color: C.textL }}>Accédez à votre espace AAR Telco</p>

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.com" required
                  style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.navy, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5 }}>Mot de passe</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{ width: "100%", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.navy, outline: "none", boxSizing: "border-box" }}
                />
              </div>

              {error && (
                <div style={{ background: "#fff0f0", border: "1px solid #E83A2E44", borderRadius: 8, padding: "9px 14px", marginBottom: 14, fontSize: 12, color: C.red, fontWeight: 600 }}>
                  ! {error}
                </div>
              )}

              <button type="submit" disabled={loading || !email || !password}
                style={{ width: "100%", background: loading || !email || !password ? C.muted : C.red, color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontWeight: 800, fontSize: 14, cursor: loading || !email || !password ? "not-allowed" : "pointer", transition: "background .2s" }}>
                {loading ? "Connexion…" : "Se connecter →"}
              </button>
            </form>

            {/* Accès rapide */}
            <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.mutedL}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                Accès rapide
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {QUICK_ACCOUNTS.map(acc => (
                  <button key={acc.email} onClick={() => quickLogin(acc)}
                    style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8f9fc", border: `1px solid ${C.mutedL}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer", textAlign: "left", width: "100%" }}
                    onMouseOver={e => e.currentTarget.style.borderColor = acc.color}
                    onMouseOut={e => e.currentTarget.style.borderColor = C.mutedL}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: acc.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>{acc.label}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{acc.email}</div>
                    </div>
                    <span style={{ fontSize: 11, color: C.sky }}>Cliquer →</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p style={{ textAlign: "center", marginTop: 14, fontSize: 10, color: C.muted }}>
            © 2026 AAR — Africa Anti-fraud &amp; Risk · Confidentiel
          </p>
        </div>
      </div>
    </div>
  );
}
