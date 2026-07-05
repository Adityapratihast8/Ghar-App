import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, shadow, formatPrice } from "@/src/theme";

export type PropertyItem = {
  id: string;
  title: string;
  listing_type: "rent" | "sale";
  category: string;
  price: number;
  city: string;
  locality: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  furnishing: string;
  images: string[];
  featured?: boolean;
  verified?: boolean;
};

type Props = {
  item: PropertyItem;
  saved?: boolean;
  onToggleSave?: (id: string) => void;
  variant?: "vertical" | "horizontal";
};

export function PropertyCard({ item, saved, onToggleSave, variant = "vertical" }: Props) {
  const router = useRouter();
  const img = item.images?.[0];

  const width = variant === "horizontal" ? 260 : undefined;

  return (
    <TouchableOpacity
      testID={`property-card-${item.id}`}
      activeOpacity={0.85}
      style={[styles.card, width ? { width } : { width: "100%" }]}
      onPress={() => router.push(`/property/${item.id}`)}
    >
      <View style={styles.imageWrap}>
        {img ? (
          <Image source={{ uri: img }} style={styles.image} />
        ) : (
          <View style={[styles.image, { backgroundColor: colors.primaryLight }]} />
        )}
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: item.listing_type === "rent" ? colors.secondary : colors.primary }]}>
            <Text style={styles.badgeText}>{item.listing_type === "rent" ? "For Rent" : "For Sale"}</Text>
          </View>
          {item.featured ? (
            <View style={[styles.badge, styles.featuredBadge]}>
              <Ionicons name="star" size={10} color="#fff" />
              <Text style={styles.badgeText}>Featured</Text>
            </View>
          ) : null}
        </View>
        {onToggleSave ? (
          <TouchableOpacity
            testID={`save-btn-${item.id}`}
            style={styles.saveBtn}
            onPress={() => onToggleSave(item.id)}
            hitSlop={8}
          >
            <Ionicons
              name={saved ? "heart" : "heart-outline"}
              size={20}
              color={saved ? colors.danger : "#fff"}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.body}>
        <View style={styles.priceRow}>
          <Text style={styles.price} numberOfLines={1}>
            {formatPrice(item.price, item.listing_type)}
          </Text>
          {item.verified ? (
            <View style={styles.verifiedChip}>
              <Ionicons name="shield-checkmark" size={11} color={colors.primary} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={12} color={colors.textMuted} />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.locality}, {item.city}
          </Text>
        </View>
        <View style={styles.metaRow}>
          {item.bedrooms > 0 && <MetaChip icon="bed-outline" label={`${item.bedrooms} BHK`} />}
          {item.bathrooms > 0 && <MetaChip icon="water-outline" label={`${item.bathrooms} Bath`} />}
          {item.area > 0 && <MetaChip icon="resize-outline" label={`${item.area} sqft`} />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function MetaChip({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.metaChip}>
      <Ionicons name={icon} size={11} color={colors.textMuted} />
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadow.card,
  },
  imageWrap: { position: "relative" },
  image: { width: "100%", height: 160 },
  badges: { position: "absolute", top: spacing.sm, left: spacing.sm, flexDirection: "row", gap: 4 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  featuredBadge: { backgroundColor: colors.warning },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  saveBtn: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: spacing.md, gap: 4 },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  price: { fontSize: 18, fontWeight: "800", color: colors.text },
  verifiedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  verifiedText: { fontSize: 10, color: colors.primary, fontWeight: "700" },
  title: { fontSize: 14, fontWeight: "600", color: colors.text },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  locationText: { fontSize: 12, color: colors.textMuted, flex: 1 },
  metaRow: { flexDirection: "row", gap: spacing.sm, marginTop: 4, flexWrap: "wrap" },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 11, color: colors.textMuted, fontWeight: "500" },
});
