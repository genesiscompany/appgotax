import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "@/constants/api";

export interface ProUser {
  id: number;
  nome: string;
  telefone: string;
  cpf?: string;
  email?: string;
  foto?: string;
  status: string;
  tipo_profissional: string;
  cidade?: string;
  estado?: string;
  veiculo_marca?: string;
  veiculo_modelo?: string;
  veiculo_ano?: number;
  veiculo_cor?: string;
  veiculo_placa?: string;
  tipo_veiculo?: string;
  doc_cnh_status: string;
  doc_veiculo_status: string;
  doc_selfie_status: string;
  percentual_repasse: number;
  saldo: number;
  total_ganhos: number;
  total_corridas: number;
  avaliacao_media: number;
  token: string;
}

interface AuthContextType {
  user: ProUser | null;
  token: string | null;
  loading: boolean;
  login: (telefone: string, pin: string) => Promise<{ ok: boolean; error?: string }>;
  cadastro: (data: CadastroData) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshPerfil: () => Promise<void>;
}

interface CadastroData {
  nome: string;
  telefone: string;
  pin: string;
  cpf?: string;
  email?: string;
  tipo_profissional: string;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ProUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("@gotaxipro:user");
        const storedToken = await AsyncStorage.getItem("@gotaxipro:token");
        if (stored && storedToken) {
          setUser(JSON.parse(stored));
          setToken(storedToken);
        }
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  const login = async (telefone: string, pin: string) => {
    try {
      const res = await apiFetch("/api/motorista-app/login", {
        method: "POST",
        body: JSON.stringify({ telefone, pin }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || "Credenciais inválidas" };
      await AsyncStorage.setItem("@gotaxipro:user", JSON.stringify(data));
      await AsyncStorage.setItem("@gotaxipro:token", data.token);
      setUser(data);
      setToken(data.token);
      return { ok: true };
    } catch (_) {
      return { ok: false, error: "Erro de conexão. Verifique sua internet." };
    }
  };

  const cadastro = async (data: CadastroData) => {
    try {
      const res = await apiFetch("/api/motorista-app/cadastro", {
        method: "POST",
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) return { ok: false, error: json.error || "Erro ao cadastrar" };
      await AsyncStorage.setItem("@gotaxipro:user", JSON.stringify(json));
      await AsyncStorage.setItem("@gotaxipro:token", json.token);
      setUser(json);
      setToken(json.token);
      return { ok: true };
    } catch (_) {
      return { ok: false, error: "Erro de conexão. Verifique sua internet." };
    }
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(["@gotaxipro:user", "@gotaxipro:token"]);
    setUser(null);
    setToken(null);
  };

  const refreshPerfil = async () => {
    if (!token) return;
    try {
      const res = await apiFetch("/api/motorista-app/perfil", {}, token);
      if (res.ok) {
        const data = await res.json();
        const updated = { ...data, token };
        await AsyncStorage.setItem("@gotaxipro:user", JSON.stringify(updated));
        setUser(updated);
      }
    } catch (_) {}
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, cadastro, logout, refreshPerfil }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
