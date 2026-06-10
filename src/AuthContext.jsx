import { createContext, useContext, useState, useCallback } from "react";
import { MOCK_USERS } from "./mockData.js";
import { ROLE_PERMISSIONS } from "./theme.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = useCallback((action, entity, entityId, detail, page) => {
    const entry = {
      id: `l${Date.now()}${Math.random()}`,
      ts: new Date().toISOString().replace("T", " ").slice(0, 19),
      userId: currentUser?.id,
      userName: currentUser?.name,
      userRole: currentUser?.role,
      action, entity, entityId, detail, page,
      ip: "192.168.1.10",
    };
    setLogs(p => [entry, ...p]);
    return entry;
  }, [currentUser]);

  // ── Login : cherche d'abord dans MOCK_USERS (démo), puis fallback opérateur ──
  const login = useCallback((email, supabaseUsers = []) => {
    // 1. Cherche dans MOCK_USERS (comptes GFM démo)
    let user = MOCK_USERS.find(u => u.email === email && u.active);

    // 2. Si pas trouvé, cherche dans les users Supabase passés en paramètre
    if (!user && supabaseUsers.length > 0) {
      user = supabaseUsers.find(u => u.email === email && u.active);
    }

    if (user) {
      // Normaliser — s'assurer que tous les champs nécessaires existent
      const normalizedUser = {
        id: user.id || `u${Date.now()}`,
        name: user.name || user.email,
        email: user.email,
        role: user.role || "analyst",
        operator: user.operator || user.operator_name || null,
        operatorId: user.operatorId || user.operator_id || null,
        active: user.active !== false,
        avatar: user.avatar || (user.name || user.email).slice(0, 2).toUpperCase(),
        lastLogin: new Date().toISOString().replace("T", " ").slice(0, 16),
        createdAt: user.createdAt || user.created_at || "—",
      };
      setCurrentUser(normalizedUser);
      setLogs(p => [{
        id: `l${Date.now()}`,
        ts: new Date().toISOString().replace("T", " ").slice(0, 19),
        userId: normalizedUser.id,
        userName: normalizedUser.name,
        userRole: normalizedUser.role,
        action: "LOGIN", entity: "auth", entityId: null,
        detail: `Connexion réussie — ${normalizedUser.role} — ${normalizedUser.operator || "GFM"}`,
        page: "Login", ip: "192.168.1.10",
      }, ...p]);
      return { success: true, user: normalizedUser };
    }
    return { success: false, error: "Email ou mot de passe incorrect" };
  }, []);

  const logout = useCallback(() => {
    if (currentUser) {
      setLogs(p => [{
        id: `l${Date.now()}`,
        ts: new Date().toISOString().replace("T", " ").slice(0, 19),
        userId: currentUser.id, userName: currentUser.name, userRole: currentUser.role,
        action: "LOGOUT", entity: "auth", entityId: null,
        detail: `Déconnexion — ${currentUser.role}`,
        page: "App", ip: "192.168.1.10",
      }, ...p]);
    }
    setCurrentUser(null);
  }, [currentUser]);

  const can = useCallback((permission) => {
    if (!currentUser) return false;
    return ROLE_PERMISSIONS[currentUser.role]?.[permission] === true;
  }, [currentUser]);

  const isGFM = useCallback(() => {
    return ["superadmin", "gfm_analyst"].includes(currentUser?.role);
  }, [currentUser]);

  const updatePassword = useCallback((newPassword) => {
    addLog("CHANGE_PASSWORD", "user", currentUser?.id, "Mot de passe modifié", "Profil");
    return { success: true };
  }, [currentUser, addLog]);

  return (
    <AuthContext.Provider value={{
      currentUser, setCurrentUser,
      login, logout,
      can, isGFM,
      logs, addLog, setLogs,
      updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}