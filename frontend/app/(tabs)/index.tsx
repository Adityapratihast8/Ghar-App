import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius } from "@/src/theme";
import { PropertyCard, type PropertyItem } from "@/src/components/PropertyCard";

const CATEGORIES = [
  { key: "apartment", label: "Apartment", icon: "business" },
  { key: "villa", label: "Villa", icon: "home" },
  { key: "builder_floor", label: "Floor", icon: "layers" },
  { key: "pg", label: "PG", icon: "bed" },
  { key: "shop", label: "Shop", icon: "storefront" },
  { key: "office", label: "Office", icon: "briefcase" },
  { key: "plot", label: "Plot", icon: "map" },
];

const LISTING_TABS: Array<{ key: "all" | "rent" | "sale"; label: string }> = [
  { key: "all", label: "All" },
  { key: "rent", label: "For Rent" },
  { key: "sale", label: "For Sale" },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [listing, setListing] = useState<"all" | "rent" | "sale">("all");
  const [featured, setFeatured] = useState<PropertyItem[]>([]);
  const [latest, setLatest] = useState<PropertyItem[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const filters: any = {};
      if (listing !== "all") filters.listing_type = listing;

      const [featRes, latestRes, wishRes] = await Promise.all([
        api.listProperties({ ...filters, featured: true }),
        api.listProperties(filters),
        user ? api.getWishlist().catch(() => []) : Promise.resolve([]),
      ]);
      setFeatured(featRes);
      setLatest(latestRes);
      setSavedIds(new Set(wishRes.map((p: any) => p.id)));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [listing, user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSave = async (id: string) => {
    if (!user) {
      router.push("/auth/phone");
      return;
    }
    const isSaved = savedIds.has(id);
    const next = new Set(savedIds);
    if (isSaved) next.delete(id);
    else next.add(id);
    setSavedIds(next);
    try {
      if (isSaved) await api.removeWishlist(id);
      else await api.addWishlist(id);
    } catch {
      // revert
      const revert = new Set(next);
      if (isSaved) revert.add(id);
      else revert.delete(id);
      setSavedIds(revert);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{user?.name ? `Hi, ${user.name.split(" ")[0]}` : "Welcome"}</Text>
            <Text style={styles.subGreeting}>Find your dream home</Text>
          </View>
          <TouchableOpacity
            testID="profile-shortcut"
            style={styles.avatar}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Ionicons name="person" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <TouchableOpacity
          testID="home-search-bar"
          style={styles.searchBar}
          onPress={() => router.push("/(tabs)/search")}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Search by city, locality, or landmark"
            placeholderTextColor={colors.textLight}
            style={styles.searchInput}
            editable={false}
          />
          <Ionicons name="options" size={18} color={colors.primary} />
        </TouchableOpacity>

        {/* Listing type tabs */}
        <View style={styles.tabsRow}>
          {LISTING_TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              testID={`home-tab-${t.key}`}
              style={[styles.tab, listing === t.key && styles.tabActive]}
              onPress={() => setListing(t.key)}
            >
              <Text style={[styles.tabText, listing === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Categories */}
        <Text style={styles.sectionTitle}>Browse by Category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.key}
              testID={`category-${c.key}`}
              style={styles.catItem}
              onPress={() =>
                router.push({ pathname: "/(tabs)/search", params: { category: c.key } })
              }
            >
              <View style={styles.catIcon}>
                <Ionicons name={c.icon as any} size={22} color={colors.primary} />
              </View>
              <Text style={styles.catLabel}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            {featured.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Featured Properties</Text>
                  <TouchableOpacity onPress={() => router.push({ pathname: "/(tabs)/search", params: { featured: "true" } })}>
                    <Text style={styles.seeAll}>See all</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  horizontal
                  data={featured}
                  keyExtractor={(i) => i.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: spacing.md, paddingHorizontal: spacing.lg }}
                  renderItem={({ item }) => (
                    <PropertyCard
                      item={item}
                      variant="horizontal"
                      saved={savedIds.has(item.id)}
                      onToggleSave={toggleSave}
                    />
                  )}
                />
              </>
            )}

            <View style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
              <Text style={styles.sectionTitle}>Latest Listings</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/search")}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.vertList}>
              {latest.slice(0, 5).map((item) => (
                <PropertyCard
                  key={item.id}
                  item={item}
                  saved={savedIds.has(item.id)}
                  onToggleSave={toggleSave}
                />
              ))}
              {latest.length === 0 && (
                <Text style={styles.empty}>No properties yet. Be the first to list!</Text>
              )}
            </View>
          </>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { paddingBottom: spacing.xl },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  greeting: { fontSize: 22, fontWeight: "800", color: colors.text },
  subGreeting: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  tabsRow: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  tabTextActive: { color: "#fff" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.lg,
    paddingRight: spacing.lg,
  },
  seeAll: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  catRow: { gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  catItem: { alignItems: "center", width: 68 },
  catIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  catLabel: { fontSize: 11, color: colors.text, fontWeight: "500" },
  vertList: { paddingHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.md },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing.lg },
});
