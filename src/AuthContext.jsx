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
      ts: new Date().toISOString().replace("T"," ").slice(0,19),
      userId: currentUser?.id,
      userName: currentUser?.name,
      userRole: currentUser?.role,
      action, entity, entityId, detail, page,
      ip: "192.168.1.10",
    };
    setLogs(p => [entry, ...p]);
    return entry;
  }, [currentUser]);

  const login = useCallback((email) => {
    const user = MOCK_USERS.find(u => u.email === email && u.active);
    if (user) {
      setCurrentUser(user);
      setLogs(p => [{
        id: `l${Date.now()}`,
        ts: new Date().toISOString().replace("T"," ").slice(0,19),
        userId: user.id, userName: user.name, userRole: user.role,
        action: "LOGIN", entity: "auth", entityId: null,
        detail: `Connexion réussie — ${user.role} — ${user.operator || "GFM"}`,
        page: "Login", ip: "192.168.1.10",
      }, ...p]);
      return { success: true, user };
    }
    return { success: false, error: "Email ou mot de passe incorrect" };
  }, []);

  const logout = useCallback(() => {
    if (currentUser) {
      setLogs(p => [{
        id: `l${Date.now()}`,
        ts: new Date().toISOString().replace("T"," ").slice(0,19),
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
    return ["superadmin","gfm_analyst"].includes(currentUser?.role);
  }, [currentUser]);

  const updatePassword = useCallback((newPassword) => {
    // In prod: call API. Here just log it.
    addLog("CHANGE_PASSWORD", "user", currentUser?.id, "Mot de passe modifié", "Profil");
    return { success: true };
  }, [currentUser, addLog]);

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, login, logout, can, isGFM, logs, addLog, setLogs, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}