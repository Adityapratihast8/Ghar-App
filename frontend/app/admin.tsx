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
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "calls" | "users">("pending");
  const [props, setProps] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const s = await api.adminStats().catch(() => null);
      setStats(s);
      if (tab === "calls") {
        setCalls(await api.adminCallRequests().catch(() => []));
      } else if (tab === "users") {
        setUsers(await api.adminUsers().catch(() => []));
      } else {
        setProps(await api.adminList(tab).catch(() => []));
      }
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
          {(["pending", "approved", "rejected", "calls", "users"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              testID={`admin-tab-${t}`}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => { setLoading(true); setTab(t); }}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "calls" ? "Calls" : t === "users" ? "Users" : t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : tab === "calls" ? (
          calls.length === 0 ? (
            <Text style={styles.empty}>No call requests yet</Text>
          ) : (
            calls.map((c) => (
              <View key={c.id} style={styles.callCard}>
                <View style={styles.callHeader}>
                  <Ionicons name="call" size={16} color={colors.primary} />
                  <Text style={styles.callTitle} numberOfLines={1}>{c.property_title}</Text>
                  <View style={[styles.callStatus, callStatusStyle(c.status)]}>
                    <Text style={styles.callStatusText}>{c.status.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.callRowInfo}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.callLabel}>CALLER</Text>
                    <Text style={styles.callVal}>{c.caller_name || "—"}</Text>
                    <Text style={styles.callPhone}>{c.caller_phone}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.callLabel}>OWNER</Text>
                    <Text style={styles.callVal}>{c.owner_name || "—"}</Text>
                    <Text style={styles.callPhone}>{c.owner_phone}</Text>
                  </View>
                </View>
                <Text style={styles.callTime}>
                  {new Date(c.created_at).toLocaleString()}
                </Text>
                {c.status === "pending" ? (
                  <View style={styles.callActions}>
                    <TouchableOpacity
                      testID={`call-connected-${c.id}`}
                      style={styles.actionApprove}
                      onPress={async () => { await api.adminUpdateCall(c.id, "connected"); load(); }}
                    >
                      <Text style={styles.actionApproveText}>Mark Connected</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`call-missed-${c.id}`}
                      style={styles.actionReject}
                      onPress={async () => { await api.adminUpdateCall(c.id, "missed"); load(); }}
                    >
                      <Text style={styles.actionRejectText}>Missed</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))
          )
        ) : tab === "users" ? (
          users.length === 0 ? (
            <Text style={styles.empty}>No users yet</Text>
          ) : (
            users.map((u) => (
              <View key={u.id} style={styles.userCard}>
                <View style={styles.userAvatarSquare}>
                  <Ionicons name="person" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{u.name || "Anonymous"}</Text>
                  <Text style={styles.userPhone}>{u.phone}</Text>
                  {u.email ? <Text style={styles.userEmail}>{u.email}</Text> : null}
                  <View style={styles.userMetaRow}>
                    <View style={[styles.roleTag, roleStyle(u.role)]}>
                      <Text style={styles.roleTagText}>{u.role.toUpperCase()}</Text>
                    </View>
                    {u.verified ? (
                      <View style={styles.verifiedTag}>
                        <Ionicons name="shield-checkmark" size={11} color={colors.primary} />
                        <Text style={styles.verifiedTagText}>Verified</Text>
                      </View>
                    ) : null}
                    <Text style={styles.userDate}>
                      Joined {new Date(u.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )
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

function callStatusStyle(status: string) {
  if (status === "connected") return { backgroundColor: colors.primary };
  if (status === "missed") return { backgroundColor: colors.danger };
  return { backgroundColor: colors.warning };
}

function roleStyle(role: string) {
  if (role === "admin") return { backgroundColor: colors.accent };
  if (role === "owner") return { backgroundColor: colors.primary };
  return { backgroundColor: colors.textMuted };
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
  callCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: 8,
    ...shadow.card,
  },
  callHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  callTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text },
  callStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  callStatusText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  callRowInfo: { flexDirection: "row", gap: spacing.md, marginTop: 4 },
  callLabel: { fontSize: 9, color: colors.textMuted, fontWeight: "700", letterSpacing: 0.5 },
  callVal: { fontSize: 13, color: colors.text, fontWeight: "600", marginTop: 2 },
  callPhone: { fontSize: 11, color: colors.textMuted },
  callTime: { fontSize: 11, color: colors.textLight, marginTop: 4 },
  callActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  userCard: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
    ...shadow.card,
  },
  userAvatarSquare: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  userName: { fontSize: 15, fontWeight: "700", color: colors.text },
  userPhone: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  userEmail: { fontSize: 11, color: colors.textLight },
  userMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" },
  roleTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  roleTagText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  verifiedTag: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: colors.primaryLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  verifiedTagText: { color: colors.primary, fontSize: 10, fontWeight: "700" },
  userDate: { fontSize: 10, color: colors.textLight },
});
