// ── SHIELD Theme — aligné AAR Mobile Money ───────────────────────────────
export const C = {
  bg: "#F2F4F8", white: "#FFFFFF",
  navy: "#0D1326", navyL: "#162040", navyB: "#1E2D5A",
  red: "#E85D20", redL: "#FDF0EA",
  orange: "#E85D20", orangeL: "#FDF0EA",
  gold: "#D4921A", goldL: "#FBF3E2",
  sky: "#2B8BBF", skyL: "#E8F4FB",
  muted: "#7A849C", mutedL: "#E4E7F0",
  success: "#1A9461", successL: "#E6F6EF",
  warning: "#C4820F", warningL: "#FAF1E0",
  danger: "#C93535", dangerL: "#FAEAEA",
  purple: "#5B43D6", purpleL: "#EEEBFD",
  teal: "#0E9E91", tealL: "#E4F6F5",
  pink: "#C94A86", pinkL: "#FBEAF3",
  indigo: "#3A58D4", indigoL: "#EAEEFB",
  lime: "#6A9E12", limeL: "#EFF6E0",
  magenta: "#9E1589", magentaL: "#F7E4F3",
  text: "#111827", textL: "#3D4A66",
};

export const FRAUD_CATEGORIES = {
  "Télécom": {
    color: C.red, icon: "TEL",
    types: ["SIM Box","IRSF","Wangiri","Bypass GSM","SIM Swap","Spoofing CLI","Roaming Fraud","Flash Calls","PBX Hacking","Subscription Fraud","Dealer Fraud","Grey Routes","Bypass Fees"]
  },
  "Mobile Money": {
    color: C.teal, icon: "MM",
    types: ["ATO","Velocity Fraud","Comptes Mules","Fraude Agents","Merchant Fraud","Refund Abuse","OTP Interception","Bonus Abuse","Dépassement comportemental","Money Muling","Social Engineering MM","Fake KYC"]
  },
  "Arnaques": {
    color: C.purple, icon: "SCAM",
    types: ["Arnaque Marabout","Police fictive","Gain fictif","Phishing opérateur","Escroquerie âgés","Usurpation identité","Investment Scam"]
  },
};

export const ALL_FRAUD_TYPES = Object.values(FRAUD_CATEGORIES).flatMap(c => c.types);

export const fraudCatColor = (type) => {
  for (const cat of Object.values(FRAUD_CATEGORIES)) {
    if (cat.types.includes(type)) return cat.color;
  }
  return C.muted;
};
export const fraudCatIcon = (type) => {
  for (const cat of Object.values(FRAUD_CATEGORIES)) {
    if (cat.types.includes(type)) return cat.icon;
  }
  return "!";
};
export const fraudCatName = (type) => {
  for (const [name, cat] of Object.entries(FRAUD_CATEGORIES)) {
    if (cat.types.includes(type)) return name;
  }
  return "Autre";
};

export const sevColor = s => ({ critical: C.danger, high: C.warning, medium: C.sky, low: C.success }[s] || C.muted);
export const sevLabel = s => ({ critical: "Critique", high: "Élevé", medium: "Moyen", low: "Faible" }[s] || s);
export const statusColor = s => ({ blocked: C.danger, alert: C.warning, monitor: C.sky, cleared: C.success, investigating: C.purple, escalated: C.warning, false_positive: C.success, closed: C.muted }[s] || C.muted);
export const statusLabel = s => ({ blocked: "BLOQUÉ", alert: "ALERTE", monitor: "SURVEILLANCE", cleared: "RÉSOLU", investigating: "EN COURS", escalated: "ESCALADÉ", false_positive: "FAUX POSITIF", closed: "CLÔTURÉ" }[s] || s);

export const ROLES = {
  superadmin: { label: "Super Admin", color: C.red, icon: "", org: "AAR" },
  gfm_analyst: { label: "AAR Analyste", color: C.purple, icon: "", org: "AAR" },
  admin: { label: "Admin Opérateur", color: C.sky, icon: "", org: "operator" },
  analyst: { label: "Fraud Analyst", color: C.teal, icon: "", org: "operator" },
  supervisor: { label: "Superviseur", color: C.warning, icon: "", org: "operator" },
};

export const GFM_ROLES = ["superadmin", "gfm_analyst"];
export const OP_ROLES = ["admin", "analyst", "supervisor"];

export const ROLE_PERMISSIONS = {
  superadmin: {
    viewAll: true, manageUsers: true, manageRoles: true, editEmail: true,
    resetPassword: true, createRules: true, editRules: true, deleteRules: true,
    blockSIM: true, manageLists: true, createCases: true, assignCases: true,
    viewLogs: true, manageUDF: true, manageSettings: true, exportData: true,
    manageOperators: true, viewAllOperators: true, managePermissions: true,
    accessAI: true, viewBilling: true, editOperator: true, onboardOperator: true,
    viewBlockings: true, unblockSIM: true, editCDRFields: true,
  },
  gfm_analyst: {
    viewAll: true, manageUsers: false, manageRoles: false, editEmail: false,
    resetPassword: false, createRules: true, editRules: true, deleteRules: false,
    blockSIM: true, manageLists: true, createCases: true, assignCases: true,
    viewLogs: true, manageUDF: false, manageSettings: false, exportData: true,
    manageOperators: false, viewAllOperators: true, managePermissions: false,
    accessAI: true, viewBilling: false, editOperator: false, onboardOperator: false,
    viewBlockings: true, unblockSIM: true, editCDRFields: false,
  },
  admin: {
    viewAll: true, manageUsers: true, manageRoles: false, editEmail: false,
    resetPassword: true, createRules: true, editRules: true, deleteRules: true,
    blockSIM: true, manageLists: true, createCases: true, assignCases: true,
    viewLogs: true, manageUDF: true, manageSettings: true, exportData: true,
    manageOperators: false, viewAllOperators: false, managePermissions: false,
    accessAI: false, viewBilling: false, editOperator: false, onboardOperator: false,
    viewBlockings: true, unblockSIM: true, editCDRFields: false,
  },
  analyst: {
    viewAll: true, manageUsers: false, manageRoles: false, editEmail: false,
    resetPassword: false, createRules: false, editRules: false, deleteRules: false,
    blockSIM: true, manageLists: true, createCases: false, assignCases: false,
    viewLogs: true, manageUDF: false, manageSettings: false, exportData: true,
    manageOperators: false, viewAllOperators: false, managePermissions: false,
    accessAI: false, viewBilling: false, editOperator: false, onboardOperator: false,
    viewBlockings: true, unblockSIM: false, editCDRFields: false,
  },
  supervisor: {
    viewAll: true, manageUsers: false, manageRoles: false, editEmail: false,
    resetPassword: false, createRules: false, editRules: false, deleteRules: false,
    blockSIM: false, manageLists: false, watchlistOnly: true, createCases: false,
    assignCases: false, viewLogs: true, manageUDF: false, manageSettings: false,
    exportData: false, manageOperators: false, viewAllOperators: false, managePermissions: false,
    accessAI: false, viewBilling: false, editOperator: false, onboardOperator: false,
    viewBlockings: true, unblockSIM: false, editCDRFields: false,
  },
};

export const ACTIONS = ["block","alert","monitor","block_mm_tx","require_otp","limit_amount"];
export const ACTION_LABELS = {
  block: "Bloquer", alert: "Alerter", monitor: "Surveiller",
  block_mm_tx: "Bloquer transaction MM", require_otp: "Exiger OTP", limit_amount: "Limiter montant",
};
export const COMPARATORS = [">","<",">=","<=","=","!=","contient","commence par","finit par","est dans la liste"];