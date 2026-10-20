import React, { useEffect, useState } from "react";
import { useProAuth, PRO_COLORS } from "@/context/ProAuthContext";
import GeneroObrigatorio from "@/components/GeneroObrigatorio";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export default function GeneroProGate() {
  const { proUser, refreshPerfil, updateLocal } = useProAuth();
  const [verificado, setVerificado] = useState(false);

  useEffect(() => {
    if (!proUser?.token || verificado) return;
    if (proUser.genero) { setVerificado(true); return; }
    refreshPerfil().finally(() => setVerificado(true));
  }, [proUser?.token, proUser?.genero, verificado, refreshPerfil]);

  if (!proUser) return null;
  return (
    <GeneroObrigatorio
      visible={verificado && !proUser.genero}
      escuro
      cor={PRO_COLORS[proUser.tipo_profissional] || "#F5C518"}
      onSalvar={async genero => {
        try {
          const res = await fetch(`${API_BASE}/motorista-app/preferencias`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${proUser.token}` },
            body: JSON.stringify({ genero }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return data.message || "Não foi possível salvar.";
          updateLocal({ genero: data.genero, aceita_passageiros: data.aceita_passageiros });
          return null;
        } catch {
          return "Sem conexão. Tente novamente.";
        }
      }}
    />
  );
}
