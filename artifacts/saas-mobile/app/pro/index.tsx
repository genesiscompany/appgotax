import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useProAuth } from "@/context/ProAuthContext";

export default function ProIndex() {
  const { proUser, isLoaded } = useProAuth();

  useEffect(() => {
    if (!isLoaded) return;
    if (!proUser) {
      router.replace("/pro/bem-vindo" as any);
    } else if (proUser.status === "aprovado") {
      router.replace("/pro/(tabs)" as any);
    } else {
      router.replace("/pro/pendente" as any);
    }
  }, [proUser, isLoaded]);

  return (
    <View style={{ flex: 1, backgroundColor: "#0D0D0D", justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color="#F5C518" />
    </View>
  );
}
