import { Stack } from "expo-router";
import { ProAuthProvider } from "@/context/ProAuthContext";

export default function ProLayout() {
  return (
    <ProAuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="bem-vindo" />
        <Stack.Screen name="login" />
        <Stack.Screen name="cadastro" />
        <Stack.Screen name="pendente" />
        <Stack.Screen name="tur-viagens" />
        <Stack.Screen name="tur-viagens-cadastro" />
        <Stack.Screen name="oferecer-carona" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="corrida-ativa"
          options={{ gestureEnabled: false, animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="entrega-ativa"
          options={{ gestureEnabled: false, animation: "slide_from_bottom" }}
        />
      </Stack>
    </ProAuthProvider>
  );
}
