import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

const STORAGE_KEY = "@gotaxi_pro_user";
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export type TipoPro = "motorista" | "entregador" | "delivery";

export interface ProUser {
  id: number;
  nome: string;
  telefone: string;
  cpf?: string;
  email?: string;
  foto?: string;
  status: string;
  tipo_profissional: TipoPro;
  cidade?: string;
  estado?: string;
  veiculo_marca?: string;
  veiculo_modelo?: string;
  veiculo_ano?: number;
  veiculo_cor?: string;
  veiculo_placa?: string;
  tipo_veiculo?: string;
  categorias_habilitadas?: { categoria_id: number; categoria_nome: string }[];
  doc_cnh_status: string;
  doc_veiculo_status: string;
  doc_selfie_status: string;
  percentual_repasse: number;
  status_repasse: string;
  saldo: number;
  total_ganhos: number;
  total_corridas: number;
  avaliacao_media: number;
  criado_em: string;
  token: string;
  pix_tipo?: string;
  pix_chave?: string;
  pix_imagem_url?: string;
  codigo_referral?: string | null;
}

interface ProAuthContextType {
  proUser: ProUser | null;
  isLoaded: boolean;
  isLoggedIn: boolean;
  online: boolean;
  setOnline: React.Dispatch<React.SetStateAction<boolean>>;
  login: (telefone: string, pin: string) => Promise<{ ok: boolean; error?: string }>;
  cadastro: (data: {
    nome: string; telefone: string; pin: string;
    cpf?: string; tipo_profissional: TipoPro;
  }) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshPerfil: () => Promise<void>;
  updateLocal: (data: Partial<ProUser>) => void;
}

const ProAuthContext = createContext<ProAuthContextType | null>(null);

const PING_INTERVAL_MS = 15_000; // send GPS every 15 seconds

export function ProAuthProvider({ children }: { children: React.ReactNode }) {
  const [proUser, setProUser] = useState<ProUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [online, setOnline] = useState(false);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const proUserRef = useRef<ProUser | null>(null);
  proUserRef.current = proUser;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) { try { setProUser(JSON.parse(raw)); } catch {} }
      setIsLoaded(true);
    }).catch(() => setIsLoaded(true));
  }, []);

  // ── GPS tracking loop ─────────────────────────────────────────────────────
  // Strategy: ALWAYS keep ultimo_ping fresh by hitting /status-online first
  // (no GPS needed). Then try to update lat/lng via /localizacao. If GPS fails
  // we still appear online to the PDV — just with stale coordinates.
  const permissionWarnedRef = useRef(false);

  const pingOnline = useCallback(async () => {
    const user = proUserRef.current;
    if (!user?.token) return;
    try {
      await fetch(`${API_BASE}/motorista-app/status-online`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ online: true }),
      });
    } catch {}
  }, []);

  const pingOffline = useCallback(async () => {
    const user = proUserRef.current;
    if (!user?.token) return;
    try {
      await fetch(`${API_BASE}/motorista-app/status-online`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ online: false }),
      });
    } catch {}
  }, []);

  const sendGpsLocation = useCallback(async () => {
    const user = proUserRef.current;
    if (!user?.token) return;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (!permissionWarnedRef.current && Platform.OS !== "web") {
          permissionWarnedRef.current = true;
          Alert.alert(
            "Permissão de localização necessária",
            "Para você aparecer no mapa do parceiro como boy disponível, precisamos da sua localização. Ative a permissão nas configurações do telefone.",
          );
        }
        return;
      }
      permissionWarnedRef.current = false;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await fetch(`${API_BASE}/motorista-app/localizacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ lat: loc.coords.latitude, lng: loc.coords.longitude, online: true }),
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
    if (online) {
      // Mark online + push GPS immediately
      pingOnline();
      sendGpsLocation();
      // Keep both alive on a timer
      pingRef.current = setInterval(() => {
        pingOnline();
        sendGpsLocation();
      }, PING_INTERVAL_MS);
    } else {
      pingOffline();
    }
    return () => { if (pingRef.current) clearInterval(pingRef.current); };
  }, [online, pingOnline, pingOffline, sendGpsLocation]);

  const save = async (u: ProUser | null) => {
    if (u) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else await AsyncStorage.removeItem(STORAGE_KEY);
    setProUser(u);
  };

  const login = useCallback(async (telefone: string, pin: string) => {
    try {
      const res = await fetch(`${API_BASE}/motorista-app/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone: telefone.replace(/\D/g, ""), pin }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || "Credenciais inválidas" };
      await save(data);
      return { ok: true };
    } catch {
      return { ok: false, error: "Sem conexão. Verifique sua internet." };
    }
  }, []);

  const cadastro = useCallback(async (form: {
    nome: string; telefone: string; pin: string;
    cpf?: string; tipo_profissional: TipoPro;
  }) => {
    const url = `${API_BASE}/motorista-app/cadastro`;
    try {
      console.log("[cadastro] POST", url, { ...form, pin: "***" });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, telefone: form.telefone.replace(/\D/g, "") }),
      });
      const data = await res.json().catch(() => ({}));
      console.log("[cadastro] response", res.status, data);
      if (!res.ok) return { ok: false, error: data.error || `Erro ${res.status} ao cadastrar` };
      if (!data?.id || !data?.token) {
        return { ok: false, error: "Resposta inválida do servidor (sem id/token)." };
      }
      await save(data);
      return { ok: true };
    } catch (err: any) {
      console.log("[cadastro] erro fetch:", err?.message || err);
      return { ok: false, error: `Sem conexão (${err?.message || "fetch falhou"}). Verifique sua internet.` };
    }
  }, []);

  const logout = useCallback(async () => {
    // Logout: limpa AsyncStorage AGORA mas defere o setProUser(null) para
    // depois da navegação. Caso contrário, telas ainda montadas (perfil,
    // pendente, tabs) re-renderizam com proUser=null antes de desmontar e
    // estouram no ErrorBoundary ("Something went wrong").
    // 800ms cobre transição de Stack.replace + animação padrão do expo-router
    // em devices mais lentos.
    try { await AsyncStorage.removeItem(STORAGE_KEY); } catch {}
    setOnline(false);
    setTimeout(() => setProUser(null), 800);
  }, []);

  const refreshPerfil = useCallback(async () => {
    if (!proUser?.token) return;
    try {
      const res = await fetch(`${API_BASE}/motorista-app/perfil`, {
        headers: { Authorization: `Bearer ${proUser.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        await save({ ...data, token: proUser.token });
      }
    } catch {}
  }, [proUser]);

  const updateLocal = useCallback((data: Partial<ProUser>) => {
    if (!proUser) return;
    const updated = { ...proUser, ...data };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setProUser(updated);
  }, [proUser]);

  return (
    <ProAuthContext.Provider value={{
      proUser, isLoaded, isLoggedIn: !!proUser,
      online, setOnline,
      login, cadastro, logout, refreshPerfil, updateLocal,
    }}>
      {children}
    </ProAuthContext.Provider>
  );
}

export function useProAuth() {
  const ctx = useContext(ProAuthContext);
  if (!ctx) throw new Error("useProAuth must be inside ProAuthProvider");
  return ctx;
}

export const PRO_COLORS: Record<TipoPro, string> = {
  motorista: "#3B82F6",
  entregador: "#10B981",
  delivery:   "#F97316",
};

export const PRO_LABELS: Record<TipoPro, string> = {
  motorista: "Motorista de App",
  entregador: "Entregador",
  delivery:   "Delivery de Comida",
};

export const PRO_ICONS: Record<TipoPro, string> = {
  motorista: "🚗",
  entregador: "📦",
  delivery:   "🍔",
};

export const PRO_JOB: Record<TipoPro, string> = {
  motorista: "Corridas",
  entregador: "Entregas",
  delivery:   "Pedidos",
};
