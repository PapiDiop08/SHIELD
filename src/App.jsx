import { useState, useEffect, useRef, Component } from "react";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import Login from "./pages/Login.jsx";
import Layout from "./pages/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Detections from "./pages/Alerts.jsx";
import Cases from "./pages/Cases.jsx";
import Rules from "./pages/Rules.jsx";
import Lists from "./pages/Lists.jsx";
import Cells from "./pages/Cells.jsx";
import Complaints from "./pages/Complaints.jsx";
import Reports from "./pages/Reports.jsx";
import Logs from "./pages/Logs.jsx";
import Admin from "./pages/Admin.jsx";
import UDFManager from "./pages/UDFManager.jsx";
import Settings from "./pages/Settings.jsx";
import Operators from "./pages/Operators.jsx";
import Blockings from "./pages/Blockings.jsx";
import AIAnalysis from "./pages/AIAnalysis.jsx";
import Billing from "./pages/Billing.jsx";
import Distributors from "./pages/Distributors.jsx";
import SimManagement from "./pages/SimManagement.jsx";
import FinancialReporting from "./pages/FinancialReporting.jsx";
import UserProfile from "./pages/UserProfile.jsx";
import SimProfile from "./pages/SimProfile.jsx";
import CdrSimulator from "./pages/CdrSimulator.jsx";
import RulesReview from "./pages/RulesReview.jsx";

import {
  useAlerts, useRules, useBlockings, useOperators,
  useUsers, useComplaints, useControlLists, saveLogToSupabase
} from "./hooks/useSupabase.js";

import { ALL_FRAUD_TYPES } from "./theme.js";
import { supabase } from "./supabase.js";

// ── Écran de chargement ───────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100vh", background: "#0D1B3E",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 20, fontFamily: "'DM Sans','Segoe UI',sans-serif"
    }}>
      <svg width="52" height="52" viewBox="0 0 200 200">
        <path d="M100 10 L180 50 L180 120 Q180 165 100 190 Q20 165 20 120 L20 50 Z" fill="#E83A2E" opacity="0.9"/>
        <text x="100" y="130" textAnchor="middle" fontSize="58" fontWeight="900" fill="white" fontFamily="Arial">G</text>
      </svg>
      <div style={{ color: "#fff", fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>AAR Telco</div>
      <div style={{ color: "#8A9BB5", fontSize: 13 }}>Chargement en cours…</div>
      <div style={{ display: "flex", gap: 6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: "50%", background: "#5BB8E8",
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite alternate`,
            opacity: 0.4,
          }} />
        ))}
      </div>
      <style>{`@keyframes pulse { to { opacity: 1; transform: scale(1.3); } }`}</style>
    </div>
  );
}

// ── Écran de garde-fou — données critiques absentes ou inaccessibles ─────
// Remplace l'ancien fallback silencieux vers des données mock : si les
// opérateurs ou utilisateurs réels ne peuvent pas être chargés depuis
// Supabase, on affiche un diagnostic clair plutôt que de faire comme si
// tout allait bien avec de fausses données.
function DataErrorScreen({ issues, onRetry }) {
  return (
    <div style={{
      minHeight: "100vh", background: "#0D1B3E",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 18, fontFamily: "'DM Sans','Segoe UI',sans-serif",
      padding: 24, textAlign: "center",
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#E85D20" strokeWidth="2">
        <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div style={{ color: "#fff", fontWeight: 800, fontSize: 18, maxWidth: 480 }}>Connexion aux données impossible</div>
      <div style={{ color: "#8A9BB5", fontSize: 13, maxWidth: 480, lineHeight: 1.6 }}>
        SHIELD n'affiche jamais de données fictives à la place de vraies données. Corrigez le point ci-dessous puis réessayez.
      </div>
      <div style={{ background: "rgba(232,93,32,0.1)", border: "1px solid rgba(232,93,32,0.35)", borderRadius: 10, padding: "14px 18px", maxWidth: 480, textAlign: "left" }}>
        {issues.map((msg, i) => (
          <div key={i} style={{ color: "#FFD9C2", fontSize: 12, marginBottom: i < issues.length - 1 ? 8 : 0 }}>• {msg}</div>
        ))}
      </div>
      <button
        onClick={onRetry}
        style={{ marginTop: 4, padding: "9px 20px", borderRadius: 8, border: "none", background: "#E85D20", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
        Réessayer
      </button>
    </div>
  );
}

function AppInner() {
  const { currentUser, addLog, isGFM, authLoading, logs } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [simProfile, setSimProfile] = useState(null);
  const [showUserProfile, setShowUserProfile] = useState(false);

  const { operators, setOperators, loading: operatorsLoading, error: operatorsError, createOperator, updateOperator, refetch: refetchOperators } = useOperators();
  const { users, setUsers, loading: usersLoading, error: usersError, createUser, updateUser, refetch: refetchUsers } = useUsers();
  const { alerts, setAlerts, updateAlertStatus, assignAlert } = useAlerts(null);
  const { rules, setRules, createRule, updateRule, toggleRule, deleteRule, refetch: refetchRules } = useRules();
  const { blockings, setBlockings, createBlocking, unblock, reblock } = useBlockings(null);
  const { blacklist, setBlacklist, addEntry, toggleEntry, deleteEntry, moveEntry } = useControlLists(null);
  const { complaints, setComplaints } = useComplaints(null);

  // ── Re-fetch dès que l'auth est prête (évite le blocage RLS anon au premier chargement) ──
  const didRefetchRef = useRef(false);
  useEffect(() => {
    if (!authLoading && currentUser && !didRefetchRef.current) {
      didRefetchRef.current = true;
      refetchOperators();
      refetchUsers();
    }
    if (!currentUser) didRefetchRef.current = false;
  }, [authLoading, currentUser, refetchOperators, refetchUsers]);

  // ── Filtre opérateur selon le compte connecté ────────────────────────────
  const currentOperator = operators.find(o =>
    o.name === currentUser?.operator || o.id === currentUser?.operatorId
  );
  const operatorIdFilter = isGFM() ? null : currentOperator?.id;

  // ── Garde-fou données critiques ───────────────────────────────────────────
  // On attend la fin des deux chargements avant de décider quoi afficher :
  // jamais de données fictives en remplacement — soit les vraies données sont
  // là, soit on affiche un diagnostic clair (DataErrorScreen) plutôt que de
  // faire semblant que tout va bien.
  const dataLoading = operatorsLoading || usersLoading;
  const dataIssues = [];
  if (!operatorsLoading && operators.length === 0) {
    dataIssues.push(operatorsError || "Aucun opérateur chargé.");
  }
  if (!usersLoading && users.length === 0) {
    dataIssues.push(usersError || "Aucun utilisateur chargé.");
  }
  if (!isGFM() && !operatorsLoading && operators.length > 0 && !currentOperator) {
    dataIssues.push(`Le compte connecté (${currentUser?.email || currentUser?.name || "?"}) n'est rattaché à aucun opérateur existant — vérifiez son champ operator_id.`);
  }
  const isReady = !dataLoading;

  const addLogEnhanced = (action, entity, entityId, detail, pg) => {
    const log = addLog(action, entity, entityId, detail, pg);
    if (currentUser) saveLogToSupabase({ ...log, userName: currentUser.name, userRole: currentUser.role });
    return log;
  };

  const navigate = (newPage) => {
    setPage(newPage);
    if (currentUser) addLogEnhanced("VIEW_PAGE", "page", null, `Page ${newPage}`, newPage);
  };

  // Simulation désactivée — les alertes viennent des vrais CDR via FastAPI
  const [simActive, setSimActive] = useState(false);

  // ── Chargement session auth ───────────────────────────────────────────────
  if (authLoading) return <LoadingScreen />;
  // ── Pas connecté → Login ──────────────────────────────────────────────────
  if (!currentUser) return <Login />;

  // ── Chargement initial ────────────────────────────────────────────────────
  if (!isReady) return <LoadingScreen />;

  // ── Garde-fou : données critiques manquantes → diagnostic, jamais de mock ──
  if (dataIssues.length > 0) {
    return <DataErrorScreen issues={dataIssues} onRetry={() => { refetchOperators(); refetchUsers(); }} />;
  }

  // ── SimProfile ────────────────────────────────────────────────────────────
  if (simProfile) return (
    <SimProfile
      {...simProfile}
      onBack={() => setSimProfile(null)}
      setBlacklist={setBlacklist}
      setBlockings={setBlockings}
      blacklist={blacklist}
      alerts={alerts}
      users={users}
      addLog={addLogEnhanced}
      currentUser={currentUser}
      addEntry={addEntry}
      createBlocking={createBlocking}
      operators={operators}
    />
  );

  if (showUserProfile) return <UserProfile onBack={() => setShowUserProfile(false)} />;

  // ── Props partagées ───────────────────────────────────────────────────────
  const sharedProps = {
    simActive, setSimActive,
    alerts,       setAlerts,
    rules,        setRules,
    blacklist,    setBlacklist,
    users,        setUsers,
    operators,    setOperators,
    complaints,   setComplaints,
    blockings,    setBlockings,
    setSimProfile, navigate,
    addLog: addLogEnhanced,
    allAlerts: alerts,
    allUsers: users,
    updateAlertStatus, assignAlert,
    createRule, updateRule, toggleRule, deleteRule,
    createBlocking, unblock, reblock,
    addEntry, toggleEntry, deleteEntry, moveEntry,
    createOperator, updateOperator,
    createUser, updateUser,
    currentOperator, operatorIdFilter,
    cases: [],
    currentUser,
  };

  return (
    <Layout
      page={page} setPage={navigate}
      alerts={alerts} cases={[]}
      onProfileClick={() => setShowUserProfile(true)}
    >
      {page === "dashboard"  && <Dashboard  {...sharedProps} />}
      {page === "alerts"     && <Detections {...sharedProps} />}
      {page === "cases"      && <Cases      {...sharedProps} />}
      {page === "rules"      && <Rules      {...sharedProps} cases={[]} />}
      {page === "blacklist"  && <Lists      {...sharedProps} />}
      {page === "cells"      && <Cells      {...sharedProps} />}
      {page === "complaints" && <Complaints {...sharedProps} />}
      {page === "reports"    && <Reports    {...sharedProps} cases={[]} />}
      {page === "financial"   && <FinancialReporting {...sharedProps} cases={[]} />}
      {page === "logs"       && <Logs       addLog={addLogEnhanced} users={users} logs={logs || []} />}
      {page === "admin"      && <Admin      {...sharedProps} />}
      {page === "udf"        && <UDFManager addLog={addLogEnhanced} />}
      {page === "settings"   && <Settings   {...sharedProps} />}
      {page === "operators"  && <Operators  {...sharedProps} />}
      {page === "blockings"  && <Blockings  {...sharedProps} />}
      {page === "ai"         && <AIAnalysis {...sharedProps} />}
      {page === "billing"       && <Billing      {...sharedProps} />}
      {page === "distributors"  && <Distributors {...sharedProps} />}
      {page === "sim_management" && <SimManagement {...sharedProps} />}
      {page === "simulator"     && <CdrSimulator rules={rules} currentOperator={currentOperator} refetchRules={refetchRules} />}
      {page === "rules_review"  && <RulesReview rules={rules} />}
    </Layout>
  );
}

// ── Garde-fou global : capture toute erreur de rendu React ────────────────
// Sans ceci, une exception dans un composant enfant (bug de code, donnée
// inattendue) fait disparaître silencieusement toute la page — comme observé
// une fois pendant le développement. Avec ceci, l'utilisateur voit un écran
// clair au lieu d'un écran blanc, et peut revenir au dashboard sans recharger.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("SHIELD crash capturé par ErrorBoundary:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh", background: "#0D1B3E",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 16, fontFamily: "'DM Sans','Segoe UI',sans-serif",
          padding: 24, textAlign: "center",
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#E85D20" strokeWidth="2">
            <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>Une erreur est survenue sur cette page</div>
          <div style={{ color: "#8A9BB5", fontSize: 12, maxWidth: 480 }}>{String(this.state.error?.message || this.state.error)}</div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#E85D20", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Recharger l'application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return <AuthProvider><ErrorBoundary><AppInner /></ErrorBoundary></AuthProvider>;
}