import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

export const API_URL: string =
  (extra.apiUrl as string) ||
  process.env.EXPO_PUBLIC_API_URL ||
  "http://localhost:8080";

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { ...options, headers });
}
