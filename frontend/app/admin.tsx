import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { colors, spacing, radius, shadow, formatPrice } from "@/src/theme";

export default function AdminScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [props, setProps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        api.adminStats().catch(() => null),
        api.adminList(tab).catch(() => []),
      ]);
      setStats(s);
      setProps(p);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const act = async (id: string, action: "approve" | "reject" | "feature") => {
    try {
      if (action === "approve") await api.adminApprove(id);
      else if (action === "reject") await api.adminReject(id);
      else await api.adminFeature(id, true);
      load();
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="admin-back">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Panel</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {stats && (
          <View style={styles.statsGrid}>
            <StatCard label="Total Users" value={stats.total_users} icon="people" />
            <StatCard label="Total Owners" value={stats.total_owners} icon="business" />
            <StatCard label="Properties" value={stats.total_properties} icon="home" />
            <StatCard label="Pending Review" value={stats.pending_verification} icon="hourglass" color={colors.secondary} />
            <StatCard label="For Rent" value={stats.total_rent} icon="key" />
            <StatCard label="For Sale" value={stats.total_sale} icon="cash" />
          </View>
        )}

        <View style={styles.tabsRow}>
          {(["pending", "approved", "rejected"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              testID={`admin-tab-${t}`}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : props.length === 0 ? (
          <Text style={styles.empty}>No properties in this state</Text>
        ) : (
          props.map((p) => (
            <View key={p.id} style={styles.propRow}>
              <Image source={{ uri: p.images?.[0] }} style={styles.thumb} />
              <View style={{ flex: 1 }}>
                <Text style={styles.propTitle} numberOfLines={1}>{p.title}</Text>
                <Text style={styles.propMeta}>
                  {formatPrice(p.price, p.listing_type)} · {p.city}
                </Text>
                <Text style={styles.propMeta}>{p.listing_type.toUpperCase()} · {p.category}</Text>
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.actionView}
                    onPress={() => router.push(`/property/${p.id}`)}
                    testID={`view-${p.id}`}
                  >
                    <Text style={styles.actionViewText}>View</Text>
                  </TouchableOpacity>
                  {tab === "pending" && (
                    <>
                      <TouchableOpacity
                        testID={`approve-${p.id}`}
                        style={styles.actionApprove}
                        onPress={() => act(p.id, "approve")}
                      >
                        <Text style={styles.actionApproveText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={`reject-${p.id}`}
                        style={styles.actionReject}
                        onPress={() => act(p.id, "reject")}
                      >
                        <Text style={styles.actionRejectText}>Reject</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {tab === "approved" && !p.featured && (
                    <TouchableOpacity
                      testID={`feature-${p.id}`}
                      style={styles.actionFeature}
                      onPress={() => act(p.id, "feature")}
                    >
                      <Ionicons name="star" size={12} color="#fff" />
                      <Text style={styles.actionFeatureText}>Feature</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, color = colors.primary }: any) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value ?? 0}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: {
    width: "31%",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    ...shadow.card,
  },
  statIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted },
  tabsRow: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4, marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl },
  propRow: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginTop: spacing.md,
    ...shadow.card,
  },
  thumb: { width: 80, height: 80, borderRadius: radius.sm, backgroundColor: colors.border },
  propTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  propMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  actionView: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  actionViewText: { fontSize: 11, color: colors.text, fontWeight: "600" },
  actionApprove: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.primary },
  actionApproveText: { fontSize: 11, color: "#fff", fontWeight: "700" },
  actionReject: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.danger },
  actionRejectText: { fontSize: 11, color: "#fff", fontWeight: "700" },
  actionFeature: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.secondary, flexDirection: "row", alignItems: "center", gap: 4 },
  actionFeatureText: { fontSize: 11, color: "#fff", fontWeight: "700" },
});
