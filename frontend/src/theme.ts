export const colors = {
  primary: "#0D9488",
  primaryDark: "#0F766E",
  primaryLight: "#CCFBF1",
  secondary: "#F97316",
  secondaryLight: "#FFEDD5",
  accent: "#EC4899",
  accentLight: "#FCE7F3",
  background: "#FAFAF9",
  surface: "#FFFFFF",
  text: "#0F172A",
  textMuted: "#475569",
  textLight: "#94A3B8",
  border: "#E2E8F0",
  borderDark: "#CBD5E1",
  success: "#10B981",
  danger: "#EF4444",
  warning: "#F59E0B",
  overlay: "rgba(15, 23, 42, 0.55)",
  gradientStart: "#0D9488",
  gradientEnd: "#14B8A6",
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
