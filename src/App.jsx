import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import Login from "./pages/Login.jsx";
import Layout from "./pages/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Alerts from "./pages/Alerts.jsx";
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
import UserProfile from "./pages/UserProfile.jsx";
import SimProfile from "./pages/SimProfile.jsx";

import {
  useAlerts, useRules, useBlockings, useOperators,
  useUsers, useComplaints, useControlLists, saveLogToSupabase
} from "./hooks/useSupabase.js";

import { MOCK_CASES, UDF_FIELDS } from "./mockData.js";
import { ALL_FRAUD_TYPES } from "./theme.js";
import { supabase } from "./supabase.js";

function AppInner() {
  const { currentUser, addLog, isGFM } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [simProfile, setSimProfile] = useState(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [cases, setCases] = useState(MOCK_CASES);
  const [udfFields, setUdfFields] = useState(UDF_FIELDS);

  const { operators, setOperators, createOperator, updateOperator } = useOperators();
  const { users, setUsers, createUser, updateUser } = useUsers();

  const currentOperator = operators.find(o => o.name === currentUser?.operator);
  const operatorIdFilter = isGFM() ? null : currentOperator?.id;

  const { alerts, setAlerts, updateAlertStatus, assignAlert } = useAlerts(operatorIdFilter);
  const { rules, setRules, createRule, updateRule, toggleRule, deleteRule } = useRules();
  const { blockings, setBlockings, createBlocking, unblock, reblock } = useBlockings(operatorIdFilter);
  const { blacklist, setBlacklist, addEntry, toggleEntry, deleteEntry, moveEntry } = useControlLists(operatorIdFilter);
  const { complaints, setComplaints } = useComplaints(operatorIdFilter);

  const addLogEnhanced = (action, entity, entityId, detail, pg) => {
    const log = addLog(action, entity, entityId, detail, pg);
    if (currentUser) saveLogToSupabase({ ...log, userName: currentUser.name, userRole: currentUser.role });
    return log;
  };

  const navigate = (newPage) => {
    setPage(newPage);
    if (currentUser) addLogEnhanced("VIEW_PAGE", "page", null, `Page ${newPage}`, newPage);
  };

  // Live alert simulation (dev)
  useEffect(() => {
    if (!currentUser || operators.length === 0) return;
    const t = setInterval(async () => {
      const ops = operators.filter(o => o.active);
      if (!ops.length) return;
      const op = isGFM() ? ops[Math.floor(Math.random() * ops.length)] : ops.find(o => o.name === currentUser.operator);
      if (!op) return;
      await supabase.from('alerts').insert([{
        operator_id: op.id,
        msisdn: `221${Math.floor(Math.random() * 9e8 + 1e8)}`,
        fraud_type: ALL_FRAUD_TYPES[Math.floor(Math.random() * ALL_FRAUD_TYPES.length)],
        severity: ['critical','high','medium'][Math.floor(Math.random() * 3)],
        score: Math.floor(Math.random() * 40 + 55),
        status: 'alert',
        cell_id: `BTS-DKR-0${Math.floor(Math.random() * 50)}`,
        detected_at: new Date().toISOString(),
      }]);
    }, 30000);
    return () => clearInterval(t);
  }, [currentUser, operators]);

  if (!currentUser) return <Login />;

  if (simProfile) return (
    <SimProfile {...simProfile} onBack={() => setSimProfile(null)}
      setBlacklist={setBlacklist} setBlockings={setBlockings}
      blacklist={blacklist} alerts={alerts} cases={cases}
      users={users} addLog={addLogEnhanced} currentUser={currentUser} />
  );

  if (showUserProfile) return <UserProfile onBack={() => setShowUserProfile(false)} />;

  const sharedProps = {
    alerts, setAlerts,
    rules, setRules,
    blacklist, setBlacklist,
    cases, setCases,
    users, setUsers,
    operators, setOperators,
    udfFields, setUdfFields,
    complaints, setComplaints,
    blockings, setBlockings,
    setSimProfile, navigate,
    addLog: addLogEnhanced,
    allAlerts: alerts, allUsers: users,
    // Supabase actions
    updateAlertStatus, assignAlert,
    createRule, updateRule, toggleRule, deleteRule,
    createBlocking, unblock, reblock,
    addEntry, toggleEntry, deleteEntry, moveEntry,
    createOperator, updateOperator,
    createUser, updateUser,
    currentOperator, operatorIdFilter,
  };

  return (
    <Layout page={page} setPage={navigate} alerts={alerts} cases={cases}
      onProfileClick={() => setShowUserProfile(true)}>
      {page === "dashboard" && <Dashboard {...sharedProps} />}
      {page === "alerts" && <Alerts {...sharedProps} />}
      {page === "cases" && <Cases {...sharedProps} />}
      {page === "rules" && <Rules {...sharedProps} />}
      {page === "blacklist" && <Lists {...sharedProps} />}
      {page === "cells" && <Cells {...sharedProps} />}
      {page === "complaints" && <Complaints {...sharedProps} />}
      {page === "reports" && <Reports {...sharedProps} />}
      {page === "logs" && <Logs logs={[]} addLog={addLogEnhanced} users={users} />}
      {page === "admin" && <Admin {...sharedProps} />}
      {page === "udf" && <UDFManager {...sharedProps} />}
      {page === "settings" && <Settings {...sharedProps} />}
      {page === "operators" && <Operators {...sharedProps} />}
      {page === "blockings" && <Blockings {...sharedProps} />}
      {page === "ai" && <AIAnalysis {...sharedProps} />}
      {page === "billing" && <Billing {...sharedProps} />}
    </Layout>
  );
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}