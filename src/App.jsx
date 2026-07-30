import { useState, useEffect } from "react";
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
import UserProfile from "./pages/UserProfile.jsx";
import SimProfile from "./pages/SimProfile.jsx";
import CdrSimulator from "./pages/CdrSimulator.jsx";

import {
  useAlerts, useRules, useBlockings, useOperators,
  useUsers, useComplaints, useControlLists, saveLogToSupabase
} from "./hooks/useSupabase.js";

import { MOCK_USERS, MOCK_OPERATORS } from "./mockData.js";
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

function AppInner() {
  const { currentUser, addLog, isGFM, authLoading, logs } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [simProfile, setSimProfile] = useState(null);
  const [showUserProfile, setShowUserProfile] = useState(false);

  const { operators: supabaseOperators, setOperators, createOperator, updateOperator } = useOperators();
  const { users: supabaseUsers, setUsers, createUser, updateUser } = useUsers();
  const { alerts, setAlerts, updateAlertStatus, assignAlert } = useAlerts(null);
  const { rules, setRules, createRule, updateRule, toggleRule, deleteRule } = useRules();
  const { blockings, setBlockings, createBlocking, unblock, reblock } = useBlockings(null);
  const { blacklist, setBlacklist, addEntry, toggleEntry, deleteEntry, moveEntry } = useControlLists(null);
  const { complaints, setComplaints } = useComplaints(null);

  // ── Fallback : si AAR DB retourne vide, on utilise les MOCK_USERS/MOCK_OPERATORS
  // Ça évite les pages blanches si la table users/operators est vide ou RLS bloquant
  const users = supabaseUsers.length > 0 ? supabaseUsers : MOCK_USERS;
  const operators = supabaseOperators.length > 0 ? supabaseOperators : MOCK_OPERATORS;

  // ── Filtre opérateur selon le compte connecté ────────────────────────────
  const currentOperator = operators.find(o =>
    o.name === currentUser?.operator || o.id === currentUser?.operatorId
  );
  const operatorIdFilter = isGFM() ? null : currentOperator?.id;

  // ── Attendre que les données essentielles soient prêtes ──────────────────
  // On affiche l'écran de chargement seulement si on n'a ni données ni mock
  const isReady = operators.length > 0;

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
      {page === "logs"       && <Logs       addLog={addLogEnhanced} users={users} logs={logs || []} />}
      {page === "admin"      && <Admin      {...sharedProps} />}
      {page === "udf"        && <UDFManager addLog={addLogEnhanced} />}
      {page === "settings"   && <Settings   {...sharedProps} />}
      {page === "operators"  && <Operators  {...sharedProps} />}
      {page === "blockings"  && <Blockings  {...sharedProps} />}
      {page === "ai"         && <AIAnalysis {...sharedProps} />}
      {page === "billing"       && <Billing      {...sharedProps} />}
      {page === "distributors"  && <Distributors {...sharedProps} />}
      {page === "simulator"     && <CdrSimulator rules={rules} currentOperator={currentOperator} />}
    </Layout>
  );
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}