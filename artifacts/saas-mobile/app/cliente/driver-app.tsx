import { useEffect } from "react";
import { router } from "expo-router";

export default function DriverAppRedirect() {
  useEffect(() => {
    router.replace("/modulo/motorista" as any);
  }, []);
  return null;
}
