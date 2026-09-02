import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

// Push notifications were removed from Expo Go in SDK 53+.
// Skip the entire setup when running inside Expo Go to avoid the uncaught error.
const IS_EXPO_GO = Constants.appOwnership === "expo";

const API_BASE = (process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api");

const EXPO_PROJECT_ID = "4109488b-2deb-4686-afb7-5c3e46b57319";

async function getExpoPushToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return null;
    if (IS_EXPO_GO) return null;
    const Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId: EXPO_PROJECT_ID });
    return tokenData.data;
  } catch (e) {
    console.warn("usePushNotifications: getExpoPushToken error:", e);
    return null;
  }
}

async function registerToken(pushToken: string, authToken: string | null, modulo?: string) {
  try {
    const r = await fetch(`${API_BASE}/cliente/push-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: authToken, pushToken, modulo }),
    });
    if (!r.ok) console.warn("usePushNotifications: registerToken failed", r.status);
  } catch (e) {
    console.warn("usePushNotifications: registerToken error:", e);
  }
}

export function usePushNotifications(modulo?: string) {
  const { customer } = useCustomerAuth();
  const registeredRef = useRef<string | null>(null);

  useEffect(() => {
    getExpoPushToken().then(pushToken => {
      if (!pushToken) return;
      const authToken = customer?.token ?? null;
      const key = `${pushToken}_${modulo ?? ""}`;
      if (registeredRef.current === key) return;
      registeredRef.current = key;
      registerToken(pushToken, authToken, modulo);
    });
  }, [customer?.token, modulo]);
}

export function useGlobalPushNotifications() {
  usePushNotifications();
}

export { getExpoPushToken, EXPO_PROJECT_ID };
