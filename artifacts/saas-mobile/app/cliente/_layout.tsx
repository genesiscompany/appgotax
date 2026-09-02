import { Stack } from "expo-router";
import { useGlobalPushNotifications } from "@/hooks/usePushNotifications";
import { CartProvider } from "@/context/CartContext";

function PushNotificationRegistrar() {
  useGlobalPushNotifications();
  return null;
}

export default function ClienteLayout() {
  return (
    <CartProvider>
      <PushNotificationRegistrar />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="motorista" />
        <Stack.Screen name="corridas" />
        <Stack.Screen name="driver-app" />
        <Stack.Screen name="food" />
        <Stack.Screen name="ecommerce" />
        <Stack.Screen name="servicos" />
        <Stack.Screen name="passagens" />
        <Stack.Screen name="entrega" />
        <Stack.Screen name="parceiros" />
        <Stack.Screen name="lojistas" />
        <Stack.Screen name="cadastro" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="perfil" />
        <Stack.Screen name="carteira" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="afiliados" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="afiliados-relatorio" options={{ animation: "slide_from_right" }} />
      </Stack>
    </CartProvider>
  );
}
