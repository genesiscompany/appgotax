import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Empresa = {
  id: number;
  nome: string;
  codigo: string;
  logo: string | null;
  corPrimaria: string;
  plano: string;
  modulosAtivos: string[];
  ativo: boolean;
};

export type Usuario = {
  id: number;
  nome: string;
  email: string;
  telefone: string | null;
  avatar: string | null;
  papel: string;
  empresaId: number;
  ativo: boolean;
};

type AuthState = {
  token: string | null;
  usuario: Usuario | null;
  empresa: Empresa | null;
};

type AuthContextType = {
  auth: AuthState;
  login: (token: string, usuario: Usuario, empresa: Empresa | null) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ token: null, usuario: null, empresa: null });

  useEffect(() => {
    AsyncStorage.getItem("@auth").then(stored => {
      if (stored) {
        try {
          setAuth(JSON.parse(stored));
        } catch {}
      }
    });
  }, []);

  const login = async (token: string, usuario: Usuario, empresa: Empresa | null) => {
    const newAuth = { token, usuario, empresa };
    setAuth(newAuth);
    await AsyncStorage.setItem("@auth", JSON.stringify(newAuth));
  };

  const logout = async () => {
    setAuth({ token: null, usuario: null, empresa: null });
    await AsyncStorage.removeItem("@auth");
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout, isAuthenticated: !!auth.token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
