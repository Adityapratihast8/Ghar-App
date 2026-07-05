import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius } from "@/src/theme";
import { PropertyCard, type PropertyItem } from "@/src/components/PropertyCard";

const LISTING_CHIPS = [
  { key: "all", label: "All" },
  { key: "rent", label: "Rent" },
  { key: "sale", label: "Buy" },
];

const BHK_CHIPS = [1, 2, 3, 4];
const FURNISHING = ["unfurnished", "semi-furnished", "furnished"];

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; featured?: string }>();
  const { user } = useAuth();

  const [q, setQ] = useState("");
  const [listing, setListing] = useState<"all" | "rent" | "sale">("all");
  const [bhk, setBhk] = useState<number | null>(null);
  const [furnishing, setFurnishing] = useState<string | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [results, setResults] = useState<PropertyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (q) filters.q = q;
      if (listing !== "all") filters.listing_type = listing;
      if (bhk) filters.bedrooms = bhk;
      if (furnishing) filters.furnishing = furnishing;
      if (verifiedOnly) filters.verified = true;
      if (params.category) filters.category = params.category;
      if (params.featured === "true") filters.featured = true;
      if (minPrice) filters.min_price = parseFloat(minPrice);
      if (maxPrice) filters.max_price = parseFloat(maxPrice);

      const res = await api.listProperties(filters);
      setResults(res);
      if (user) {
        const wish = await api.getWishlist().catch(() => []);
        setSavedIds(new Set(wish.map((p: any) => p.id)));
      }
    } finally {
      setLoading(false);
    }
  }, [q, listing, bhk, furnishing, verifiedOnly, minPrice, maxPrice, params.category, params.featured, user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSave = async (id: string) => {
    if (!user) return router.push("/auth/phone");
    const isSaved = savedIds.has(id);
    const next = new Set(savedIds);
    if (isSaved) next.delete(id);
    else next.add(id);
    setSavedIds(next);
    try {
      if (isSaved) await api.removeWishlist(id);
      else await api.addWishlist(id);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            testID="search-input"
            style={styles.searchInput}
            placeholder="Search city, locality, title..."
            placeholderTextColor={colors.textLight}
            value={q}
            onChangeText={setQ}
            returnKeyType="search"
            onSubmitEditing={load}
          />
          {q.length > 0 && (
            <TouchableOpacity onPress={() => setQ("")}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          testID="filter-btn"
          onPress={() => setShowFilters(true)}
          style={styles.filterIconBtn}
        >
          <Ionicons name="options" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Sticky chip row */}
      <View style={styles.chipRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {LISTING_CHIPS.map((c) => (
            <TouchableOpacity
              key={c.key}
              testID={`chip-listing-${c.key}`}
              style={[styles.chip, listing === c.key && styles.chipActive]}
              onPress={() => setListing(c.key as any)}
            >
              <Text style={[styles.chipText, listing === c.key && styles.chipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
          {BHK_CHIPS.map((b) => (
            <TouchableOpacity
              key={`bhk-${b}`}
              testID={`chip-bhk-${b}`}
              style={[styles.chip, bhk === b && styles.chipActive]}
              onPress={() => setBhk(bhk === b ? null : b)}
            >
              <Text style={[styles.chipText, bhk === b && styles.chipTextActive]}>{b} BHK</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            testID="chip-verified"
            style={[styles.chip, verifiedOnly && styles.chipActive]}
            onPress={() => setVerifiedOnly(!verifiedOnly)}
          >
            <Ionicons name="shield-checkmark" size={12} color={verifiedOnly ? "#fff" : colors.primary} />
            <Text style={[styles.chipText, verifiedOnly && styles.chipTextActive]}>Verified</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <PropertyCard item={item} saved={savedIds.has(item.id)} onToggleSave={toggleSave} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            <Text style={styles.empty}>No properties match your filters</Text>
          }
        />
      )}

      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity testID="close-filter" onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>Price Range (₹)</Text>
            <View style={styles.priceRow}>
              <TextInput
                testID="min-price-input"
                style={styles.priceInput}
                placeholder="Min"
                placeholderTextColor={colors.textLight}
                keyboardType="numeric"
                value={minPrice}
                onChangeText={setMinPrice}
              />
              <Text style={{ color: colors.textMuted }}>to</Text>
              <TextInput
                testID="max-price-input"
                style={styles.priceInput}
                placeholder="Max"
                placeholderTextColor={colors.textLight}
                keyboardType="numeric"
                value={maxPrice}
                onChangeText={setMaxPrice}
              />
            </View>

            <Text style={styles.filterLabel}>Furnishing</Text>
            <View style={styles.furnishRow}>
              {FURNISHING.map((f) => (
                <TouchableOpacity
                  key={f}
                  testID={`furnish-${f}`}
                  style={[styles.furnishChip, furnishing === f && styles.chipActive]}
                  onPress={() => setFurnishing(furnishing === f ? null : f)}
                >
                  <Text style={[styles.chipText, furnishing === f && styles.chipTextActive]}>
                    {f.replace("-", " ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                testID="clear-filters"
                style={styles.clearBtn}
                onPress={() => {
                  setMinPrice("");
                  setMaxPrice("");
                  setFurnishing(null);
                  setBhk(null);
                  setVerifiedOnly(false);
                }}
              >
                <Text style={styles.clearText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="apply-filters"
                style={styles.applyBtn}
                onPress={() => {
                  setShowFilters(false);
                  load();
                }}
              >
                <Text style={styles.applyText}>Show Results</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    alignItems: "center",
  },
  searchBar: {
    flex: 1,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 12 },
  filterIconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipRowWrap: { paddingTop: spacing.md, height: 56 },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  list: { padding: spacing.lg },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl + spacing.md,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  filterLabel: { marginTop: spacing.lg, fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
  priceRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  furnishRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  furnishChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  modalActions: { flexDirection: "row", marginTop: spacing.xl, gap: spacing.md },
  clearBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
  },
  clearText: { color: colors.text, fontWeight: "600" },
  applyBtn: { flex: 2, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.md, alignItems: "center" },
  applyText: { color: "#fff", fontWeight: "700" },
});
