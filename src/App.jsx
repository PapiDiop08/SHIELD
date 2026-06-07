// ── SHIELD App ────────────────────────────────────────────────────────────
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
  MOCK_ALERTS, MOCK_RULES, MOCK_BLACKLIST, MOCK_CASES,
  MOCK_USERS, MOCK_OPERATORS, MOCK_LOGS, MOCK_BLOCKINGS,
  MOCK_COMPLAINTS, UDF_FIELDS,
} from "./mockData.js";
import { ALL_FRAUD_TYPES } from "./theme.js";

function AppInner() {
  const { currentUser, addLog, can, isGFM } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [alerts, setAlerts] = useState(MOCK_ALERTS);
  const [rules, setRules] = useState(MOCK_RULES);
  const [blacklist, setBlacklist] = useState(MOCK_BLACKLIST);
  const [cases, setCases] = useState(MOCK_CASES);
  const [users, setUsers] = useState(MOCK_USERS);
  const [operators, setOperators] = useState(MOCK_OPERATORS);
  const [udfFields, setUdfFields] = useState(UDF_FIELDS);
  const [complaints, setComplaints] = useState(MOCK_COMPLAINTS);
  const [blockings, setBlockings] = useState(MOCK_BLOCKINGS);
  const [simProfile, setSimProfile] = useState(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [tick, setTick] = useState(0);

  // Filter data by operator for non-GFM users
  const visibleAlerts = isGFM() ? alerts : alerts.filter(a => a.operator === currentUser?.operator);
  const visibleCases = isGFM() ? cases : cases.filter(c => c.operator === currentUser?.operator);
  const visibleRules = isGFM() ? rules : rules.filter(r => !r.operator || r.operator === currentUser?.operator || r.scope === "global");
  const visibleBlockings = isGFM() ? blockings : blockings.filter(b => b.operator === currentUser?.operator);
  const visibleUsers = isGFM() ? users : users.filter(u => u.operator === currentUser?.operator || u.role === "superadmin");

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 18000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!tick || !currentUser) return;
    const ops = ["Orange Sénégal","Yass Telecom","Expresso"];
    const op = isGFM() ? ops[Math.floor(Math.random()*ops.length)] : currentUser.operator;
    const newAlert = {
      id: `a${Date.now()}`,
      time: new Date().toTimeString().slice(0,5),
      msisdn: `77${Math.floor(Math.random()*900+100)}XXXXX`,
      operator: op,
      type: ALL_FRAUD_TYPES[Math.floor(Math.random()*ALL_FRAUD_TYPES.length)],
      severity: ["critical","high","medium"][Math.floor(Math.random()*3)],
      status: "alert",
      cellId: `BTS-DKR-0${Math.floor(Math.random()*50)}`,
      score: Math.floor(Math.random()*40+55),
      assignedTo: null, caseId: null, slaDeadline: null, notes: [],
      createdAt: new Date().toISOString().slice(0,19).replace("T"," "),
      imei: "35XXXXXXXXXXXX", imsi: "60801XXXXXXXXX", rule: "Règle SHIELD auto",
    };
    setAlerts(p => [newAlert, ...p.slice(0,49)]);
  }, [tick, currentUser]);

  const navigate = (newPage) => {
    setPage(newPage);
    if (currentUser && newPage !== page) {
      const pageNames = { dashboard:"Dashboard",alerts:"Alertes",cases:"Cases",rules:"Règles",blacklist:"Listes",cells:"Antennes",complaints:"Plaintes",reports:"Rapports",logs:"Audit Log",admin:"Admin",udf:"UDF Manager",settings:"Paramètres",operators:"Opérateurs",blockings:"Blocages",ai:"IA Analyse",billing:"Facturation" };
      addLog("VIEW_PAGE","page",null,`Page ${pageNames[newPage]||newPage} consultée`,newPage);
    }
  };

  if (!currentUser) return <Login />;
  if (simProfile) return <SimProfile {...simProfile} onBack={() => setSimProfile(null)} setBlacklist={setBlacklist} setBlockings={setBlockings} blacklist={blacklist} alerts={visibleAlerts} cases={visibleCases} users={users} addLog={addLog} currentUser={currentUser} />;
  if (showUserProfile) return <UserProfile onBack={() => setShowUserProfile(false)} />;

  const sharedProps = {
    alerts: visibleAlerts, setAlerts,
    rules: visibleRules, setRules,
    blacklist, setBlacklist,
    cases: visibleCases, setCases,
    users: visibleUsers, setUsers,
    operators, setOperators,
    udfFields, setUdfFields,
    complaints, setComplaints,
    blockings: visibleBlockings, setBlockings,
    setSimProfile, addLog, navigate,
    allAlerts: alerts, allUsers: users,
  };

  return (
    <Layout page={page} setPage={navigate} alerts={visibleAlerts} cases={visibleCases} onProfileClick={() => setShowUserProfile(true)}>
      {page === "dashboard" && <Dashboard {...sharedProps} />}
      {page === "alerts" && <Alerts {...sharedProps} />}
      {page === "cases" && <Cases {...sharedProps} />}
      {page === "rules" && <Rules {...sharedProps} />}
      {page === "blacklist" && <Lists {...sharedProps} />}
      {page === "cells" && <Cells {...sharedProps} />}
      {page === "complaints" && <Complaints {...sharedProps} />}
      {page === "reports" && <Reports {...sharedProps} />}
      {page === "logs" && <Logs logs={[]} addLog={addLog} users={users} />}
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