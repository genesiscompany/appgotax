import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@gotaxi_customer_v2";
const API_BASE = (process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api");
const UPLOADS_BASE = API_BASE.replace(/\/api$/, "");

function resolveAvatarUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Corrige caminhos relativos legados sem /api/
  let path = raw;
  if (path.startsWith("/uploads/")) path = `/api${path}`;
  // Já é URL absoluta
  if (path.startsWith("http://") || path.startsWith("https://")) {
    // Corrige URLs absolutas antigas que apontavam para /uploads/ sem /api/
    path = path.replace(/\/uploads\//, "/api/uploads/");
    return path;
  }
  return `${UPLOADS_BASE}${path}`;
}

export type FormaPagamento = "maquininha" | "pix" | "dinheiro" | null;

export type Customer = {
  id: number;
  nome: string;
  whatsapp: string;
  avatar: string | null;
  token: string;
  endereco: string | null;
  formaPagamento: FormaPagamento;
  codigoReferral?: string | null;
  isAfiliado?: boolean;
};

type CustomerAuthContextType = {
  customer: Customer | null;
  isLoaded: boolean;
  isLoggedIn: boolean;
  login: (whatsapp: string, senha: string) => Promise<{ ok: boolean; error?: string }>;
  register: (nome: string, whatsapp: string, senha: string, indicadoPor?: string) => Promise<{ ok: boolean; error?: string }>;
  updateProfile: (data: { nome?: string; whatsapp?: string; novaSenha?: string; endereco?: string; formaPagamento?: FormaPagamento }) => Promise<{ ok: boolean; error?: string }>;
  uploadAvatar: (uri: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
};

const CustomerAuthContext = createContext<CustomerAuthContextType | null>(null);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) { if (!cancelled) setIsLoaded(true); return; }
        let c: Customer | null = null;
        try {
          c = JSON.parse(raw) as Customer;
          if (c) c.avatar = resolveAvatarUrl(c.avatar);
        } catch { c = null; }
        if (!c || !c.token || !c.id || c.id <= 0) {
          await AsyncStorage.removeItem(STORAGE_KEY);
          if (!cancelled) setIsLoaded(true);
          return;
        }
        try {
          const res = await fetch(`${API_BASE}/auth/cliente-validar?token=${encodeURIComponent(c.token)}`);
          if (res.status === 401) {
            await AsyncStorage.removeItem(STORAGE_KEY);
            if (!cancelled) { setCustomer(null); setIsLoaded(true); }
            return;
          }
          if (res.ok) {
            const data = await res.json();
            const fresh: Customer = {
              ...c,
              id: data.usuario?.id ?? c.id,
              nome: data.usuario?.nome ?? c.nome,
              whatsapp: data.usuario?.telefone ?? c.whatsapp,
              avatar: resolveAvatarUrl(data.usuario?.avatar ?? c.avatar),
              endereco: data.usuario?.endereco ?? c.endereco,
              formaPagamento: (data.usuario?.forma_pagamento ?? c.formaPagamento) as FormaPagamento,
              codigoReferral: data.usuario?.codigo_referral ?? c.codigoReferral ?? null,
              isAfiliado: !!data.usuario?.is_afiliado,
            };
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
            if (!cancelled) { setCustomer(fresh); setIsLoaded(true); }
            return;
          }
        } catch {
          // Sem rede: mantém sessão local para não travar uso offline
        }
        if (!cancelled) { setCustomer(c); setIsLoaded(true); }
      } catch {
        if (!cancelled) setIsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async (c: Customer | null) => {
    if (c) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    else await AsyncStorage.removeItem(STORAGE_KEY);
    setCustomer(c);
  };

  const login = useCallback(async (whatsapp: string, senha: string) => {
    const num = whatsapp.replace(/\D/g, "");
    if (num.length < 10) return { ok: false, error: "WhatsApp inválido" };
    if (!senha) return { ok: false, error: "Senha obrigatória" };
    try {
      const res = await fetch(`${API_BASE}/auth/cliente-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone: num, senha }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.message || "Credenciais inválidas" };
      await save({
        id: data.usuario.id,
        nome: data.usuario.nome,
        whatsapp: data.usuario.telefone,
        avatar: resolveAvatarUrl(data.usuario.avatar),
        token: data.token,
        endereco: data.usuario.endereco ?? null,
        formaPagamento: data.usuario.forma_pagamento ?? null,
        codigoReferral: data.usuario.codigo_referral ?? null,
        isAfiliado: !!data.usuario.is_afiliado,
      });
      return { ok: true };
    } catch {
      return { ok: false, error: "Sem conexão com o servidor" };
    }
  }, []);

  const register = useCallback(async (nome: string, whatsapp: string, senha: string, indicadoPor?: string) => {
    if (!nome.trim() || nome.trim().length < 3) return { ok: false, error: "Nome deve ter ao menos 3 caracteres" };
    const num = whatsapp.replace(/\D/g, "");
    if (num.length < 10) return { ok: false, error: "WhatsApp inválido" };
    if (!senha || senha.length < 4) return { ok: false, error: "Senha deve ter ao menos 4 dígitos" };
    try {
      const indicado = indicadoPor && indicadoPor.trim() ? indicadoPor.trim().toUpperCase() : null;
      const res = await fetch(`${API_BASE}/auth/cliente-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), telefone: num, senha, indicado_por: indicado }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.message || "Erro ao cadastrar" };
      await save({
        id: data.usuario.id,
        nome: data.usuario.nome,
        whatsapp: data.usuario.telefone,
        avatar: resolveAvatarUrl(data.usuario.avatar),
        token: data.token,
        endereco: data.usuario.endereco ?? null,
        formaPagamento: data.usuario.forma_pagamento ?? null,
        codigoReferral: data.usuario.codigo_referral ?? null,
        isAfiliado: !!data.usuario.is_afiliado,
      });
      return { ok: true };
    } catch {
      return { ok: false, error: "Sem conexão com o servidor" };
    }
  }, []);

  const updateProfile = useCallback(async (data: { nome?: string; whatsapp?: string; novaSenha?: string; endereco?: string; formaPagamento?: FormaPagamento }) => {
    if (!customer) return { ok: false, error: "Não autenticado" };
    try {
      const res = await fetch(`${API_BASE}/auth/cliente-perfil`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: customer.token,
          nome: data.nome,
          telefone: data.whatsapp,
          novaSenha: data.novaSenha,
          endereco: data.endereco,
          formaPagamento: data.formaPagamento,
        }),
      });
      const json = await res.json();
      if (!res.ok) return { ok: false, error: json.message || "Erro ao salvar" };
      const updated: Customer = {
        ...customer,
        nome: json.usuario.nome,
        whatsapp: json.usuario.telefone,
        avatar: resolveAvatarUrl(json.usuario.avatar),
        endereco: json.usuario.endereco ?? customer.endereco,
        formaPagamento: json.usuario.forma_pagamento ?? customer.formaPagamento,
      };
      await save(updated);
      return { ok: true };
    } catch {
      return { ok: false, error: "Sem conexão com o servidor" };
    }
  }, [customer]);

  const uploadAvatar = useCallback(async (uri: string) => {
    if (!customer) return { ok: false, error: "Não autenticado" };
    try {
      const formData = new FormData();
      formData.append("token", customer.token);
      const filename = uri.split("/").pop() ?? "avatar.jpg";
      const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
      formData.append("avatar", { uri, name: filename, type: mimeMap[ext] ?? "image/jpeg" } as any);
      const res = await fetch(`${API_BASE}/auth/cliente-avatar`, { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) return { ok: false, error: json.message || "Erro ao enviar imagem" };
      const updated: Customer = { ...customer, avatar: resolveAvatarUrl(json.avatar) };
      await save(updated);
      return { ok: true };
    } catch {
      return { ok: false, error: "Sem conexão com o servidor" };
    }
  }, [customer]);

  const logout = useCallback(async () => { await save(null); }, []);

  return (
    <CustomerAuthContext.Provider value={{
      customer, isLoaded, isLoggedIn: !!customer,
      login, register, logout, updateProfile, uploadAvatar,
    }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used inside CustomerAuthProvider");
  return ctx;
}
