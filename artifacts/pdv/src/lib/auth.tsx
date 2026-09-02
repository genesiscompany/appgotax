import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

export interface AuthUser {
  id: number;
  nome: string;
  email: string;
  papel: string;
  empresaId: number;
  codigo_referral?: string | null;
  is_afiliado?: boolean;
}

export interface AuthEmpresa {
  id: number;
  nome: string;
  codigo: string;
  logo: string | null;
  corPrimaria: string;
  plano: string;
  modulosAtivos: string[];
  ativo: boolean;
}

interface AuthState {
  user: AuthUser | null;
  empresa: AuthEmpresa | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, senha: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);
const STORAGE_KEY = "@pdv_auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [empresa, setEmpresa] = useState<AuthEmpresa | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  // Keep tokenRef in sync for use in callbacks without stale closure
  useEffect(() => { tokenRef.current = token; }, [token]);

  // Refresh empresa data from server to pick up module changes made by admin
  const refreshEmpresa = useCallback(async (currentToken: string) => {
    try {
      const res = await fetch("/api/pdv/me", {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const updated: AuthEmpresa = {
        id: data.id,
        nome: data.nome,
        codigo: data.codigo,
        logo: data.logo,
        corPrimaria: data.corPrimaria ?? data.cor_primaria ?? "#007AFF",
        plano: data.plano,
        modulosAtivos: Array.isArray(data.modulosAtivos)
          ? data.modulosAtivos
          : Array.isArray(data.modulos_ativos)
          ? data.modulos_ativos
          : [],
        ativo: data.ativo,
      };
      setEmpresa(updated);
      // Patch user with fresh affiliate referral code returned by /me
      let userPatch: Partial<AuthUser> | null = null;
      if (data.usuario && typeof data.usuario === "object") {
        userPatch = {
          codigo_referral: data.usuario.codigo_referral ?? null,
          is_afiliado: !!data.usuario.is_afiliado,
        };
        setUser((prev) => (prev ? { ...prev, ...userPatch! } : prev));
      }
      // Update localStorage so refresh persists across page reloads
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          const nextUser = userPatch && parsed.user ? { ...parsed.user, ...userPatch } : parsed.user;
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, empresa: updated, user: nextUser }));
        }
      } catch { /* ignore */ }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      // Recebe token via URL quando vindo de página externa (ex: gotaxi.com.br/pdv)
      const params = new URLSearchParams(window.location.search);
      const authParam = params.get("_auth");
      if (authParam) {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(authParam))));
        if (decoded?.token && decoded?.user) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(decoded));
          // Remove o param da URL sem recarregar a página
          const clean = window.location.pathname + window.location.hash;
          window.history.replaceState(null, "", clean);
          setUser(decoded.user);
          setEmpresa(decoded.empresa);
          setToken(decoded.token);
          setIsLoading(false);
          return;
        }
      }

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { user: u, empresa: e, token: t } = JSON.parse(saved);
        setUser(u);
        setEmpresa(e);
        setToken(t);
      }
    } catch { /* ignore */ }
    setIsLoading(false);
  }, []);

  // Refresh empresa on window focus and every 5 minutes to pick up admin changes
  useEffect(() => {
    const doRefresh = () => {
      if (tokenRef.current) refreshEmpresa(tokenRef.current);
    };

    window.addEventListener("focus", doRefresh);
    const interval = setInterval(doRefresh, 5 * 60 * 1000);

    return () => {
      window.removeEventListener("focus", doRefresh);
      clearInterval(interval);
    };
  }, [refreshEmpresa]);

  // Also refresh immediately when token becomes available (after login/restore)
  useEffect(() => {
    if (token) refreshEmpresa(token);
  }, [token, refreshEmpresa]);

  const login = useCallback(async (email: string, senha: string) => {
    try {
      const res = await fetch("/api/pdv/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.message || "Erro ao entrar" };
      setUser(data.usuario);
      setEmpresa(data.empresa);
      setToken(data.token);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: data.usuario, empresa: data.empresa, token: data.token }));
      return { ok: true };
    } catch {
      return { ok: false, error: "Falha de conexão" };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setEmpresa(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, empresa, token, isLoading, login, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
