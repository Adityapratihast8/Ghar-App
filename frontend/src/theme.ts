export const colors = {
  primary: "#059669",
  primaryDark: "#047857",
  primaryLight: "#D1FAE5",
  secondary: "#D97706",
  secondaryLight: "#FEF3C7",
  background: "#F9FAFB",
  surface: "#FFFFFF",
  text: "#111827",
  textMuted: "#4B5563",
  textLight: "#9CA3AF",
  border: "#E5E7EB",
  borderDark: "#D1D5DB",
  success: "#10B981",
  danger: "#EF4444",
  warning: "#F59E0B",
  overlay: "rgba(0,0,0,0.5)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  strong: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

export function formatPrice(v: number, listing: "rent" | "sale" = "sale"): string {
  if (v == null || isNaN(v as any)) return "-";
  if (listing === "rent") {
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L/mo`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K/mo`;
    return `₹${v}/mo`;
  }
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
}
