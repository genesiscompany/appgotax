import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export const API = "/api/admin";

export type AdminUser = { id: number; nome: string; email: string; papel: string };

type AuthCtx = {
  user: AdminUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("admin_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(`${API}/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setUser(u); else { setToken(null); localStorage.removeItem("admin_token"); } })
      .finally(() => setLoading(false));
  }, [token]);

  const login = useCallback(async (email: string, senha: string) => {
    const r = await fetch(`${API}/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, error: data.error === "not_admin" ? "Acesso restrito a administradores" : "Email ou senha inválidos" };
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("admin_token", data.token);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    setToken(null); setUser(null);
    localStorage.removeItem("admin_token");
  }, []);

  return <Ctx.Provider value={{ user, token, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

export function authHeaders(token: string | null) {
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
