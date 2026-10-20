const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export function fotoUrl(foto?: string | null): string | null {
  if (!foto) return null;
  if (/^https?:\/\//.test(foto)) return foto;
  let p = foto.startsWith("/") ? foto : `/${foto}`;
  if (p.startsWith("/uploads/")) p = `/api${p}`;
  return `${API_BASE.replace(/\/api$/, "")}${p}`;
}
