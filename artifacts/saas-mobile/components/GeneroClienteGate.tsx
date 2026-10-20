import React from "react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import GeneroObrigatorio from "@/components/GeneroObrigatorio";

export default function GeneroClienteGate() {
  const { customer, isLoaded, definirGenero } = useCustomerAuth();
  const visible = isLoaded && !!customer && !customer.genero;
  return (
    <GeneroObrigatorio
      visible={visible}
      onSalvar={async g => {
        const r = await definirGenero(g);
        return r.ok ? null : r.error || "Não foi possível salvar.";
      }}
    />
  );
}
