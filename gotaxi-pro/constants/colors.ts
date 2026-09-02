export const Colors = {
  primary: "#FFCC00",
  primaryDark: "#E6B800",
  background: "#0A0E1A",
  surface: "#131825",
  surfaceAlt: "#1C2333",
  border: "#252D42",
  text: "#FFFFFF",
  textSecondary: "#8896B0",
  textMuted: "#4A5568",
  success: "#10B981",
  danger: "#EF4444",
  warning: "#F59E0B",
  info: "#3B82F6",
  motorista: "#3B82F6",
  delivery: "#F97316",
  entregas: "#10B981",
};

export const PRO_TYPE_COLORS: Record<string, string> = {
  motorista: Colors.motorista,
  delivery: Colors.delivery,
  entregas: Colors.entregas,
};

export const PRO_TYPE_LABELS: Record<string, string> = {
  motorista: "Motorista de App",
  delivery: "Delivery",
  entregas: "Entregas",
};

export const PRO_TYPE_ICONS: Record<string, string> = {
  motorista: "🚗",
  delivery: "🍔",
  entregas: "📦",
};

export const PRO_JOB_LABEL: Record<string, string> = {
  motorista: "Corridas",
  delivery: "Pedidos",
  entregas: "Entregas",
};
