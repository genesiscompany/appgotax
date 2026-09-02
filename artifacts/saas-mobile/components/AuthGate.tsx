import React from "react";
import { router } from "expo-router";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

type Props = {
  redirect?: string;
  children: (props: { requireAuth: (action: () => void) => void }) => React.ReactElement;
};

export function useAuthGate(redirectTo?: string) {
  const { customer, isLoaded } = useCustomerAuth();
  const hasValidAccount =
    isLoaded &&
    !!customer &&
    typeof customer.id === "number" &&
    customer.id > 0 &&
    typeof customer.token === "string" &&
    customer.token.length > 0;

  const requireAuth = (action: () => void) => {
    if (hasValidAccount) {
      action();
    } else {
      router.push({ pathname: "/cliente/cadastro" as any, params: { redirect: redirectTo || "/cliente" } });
    }
  };

  return { requireAuth, isLoggedIn: hasValidAccount };
}
