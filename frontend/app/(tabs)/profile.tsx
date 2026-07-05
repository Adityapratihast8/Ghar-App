import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";
import { colors, spacing, radius, shadow, formatPrice } from "@/src/theme";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [myProps, setMyProps] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [p, v] = await Promise.all([
        user.role === "owner" ? api.myProperties() : Promise.resolve([]),
        api.listVisits().catch(() => []),
      ]);
      setMyProps(p);
      setVisits(v);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.emptyAuth}>
          <Ionicons name="person-circle" size={80} color={colors.primary} />
          <Text style={styles.emptyTitle}>Welcome to Ghar.com</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/auth/phone")}>
            <Text style={styles.primaryBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* User card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName} testID="profile-name">{user.name || "User"}</Text>
            <Text style={styles.userMeta}>{user.phone}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>
              {user.verified && (
                <View style={styles.verifiedInline}>
                  <Ionicons name="shield-checkmark" size={12} color={colors.primary} />
                  <Text style={styles.verifiedInlineText}>Verified</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Owner actions */}
        {user.role === "owner" && (
          <TouchableOpacity
            testID="add-property-cta"
            style={styles.addBtn}
            onPress={() => router.push("/property/add")}
          >
            <Ionicons name="add-circle" size={22} color="#fff" />
            <Text style={styles.addBtnText}>List a New Property</Text>
          </TouchableOpacity>
        )}

        {/* My listings */}
        {user.role === "owner" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Listings ({myProps.length})</Text>
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : myProps.length === 0 ? (
              <Text style={styles.empty}>You haven&apos;t listed any property yet</Text>
            ) : (
              myProps.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  testID={`my-listing-${p.id}`}
                  style={styles.listingRow}
                  onPress={() => router.push(`/property/${p.id}`)}
                >
                  <Image source={{ uri: p.images?.[0] }} style={styles.listingImg} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listingTitle} numberOfLines={1}>{p.title}</Text>
                    <Text style={styles.listingPrice}>{formatPrice(p.price, p.listing_type)}</Text>
                    <View style={[styles.statusChip, statusColor(p.status)]}>
                      <Text style={[styles.statusText, statusTextColor(p.status)]}>{p.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Visit requests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visit Requests ({visits.length})</Text>
          {visits.length === 0 ? (
            <Text style={styles.empty}>No visit requests yet</Text>
          ) : (
            visits.slice(0, 5).map((v) => (
              <View key={v.id} style={styles.visitRow}>
                <Ionicons name="calendar" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.visitTitle} numberOfLines={1}>{v.property?.title || "Property"}</Text>
                  <Text style={styles.visitDate}>Visit on {new Date(v.scheduled_date).toLocaleDateString()}</Text>
                  <View style={[styles.statusChip, statusColor(v.status)]}>
                    <Text style={[styles.statusText, statusTextColor(v.status)]}>{v.status.toUpperCase()}</Text>
                  </View>
                </View>
                {v.owner_id === user.id && v.status === "pending" && (
                  <View style={{ gap: 4 }}>
                    <TouchableOpacity
                      testID={`accept-visit-${v.id}`}
                      style={styles.acceptBtn}
                      onPress={async () => { await api.updateVisit(v.id, "accepted"); load(); }}
                    >
                      <Text style={styles.acceptText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`reject-visit-${v.id}`}
                      style={styles.rejectBtn}
                      onPress={async () => { await api.updateVisit(v.id, "rejected"); load(); }}
                    >
                      <Text style={styles.rejectText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Admin panel */}
        {user.role === "admin" && (
          <TouchableOpacity
            testID="admin-panel-btn"
            style={styles.menuItem}
            onPress={() => router.push("/admin")}
          >
            <Ionicons name="shield" size={20} color={colors.secondary} />
            <Text style={styles.menuText}>Admin Panel</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
          </TouchableOpacity>
        )}

        <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out" size={20} color={colors.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function statusColor(s: string) {
  if (s === "approved" || s === "accepted") return { backgroundColor: colors.primaryLight };
  if (s === "rejected" || s === "sold" || s === "rented") return { backgroundColor: "#FEE2E2" };
  return { backgroundColor: colors.secondaryLight };
}
function statusTextColor(s: string) {
  if (s === "approved" || s === "accepted") return { color: colors.primary };
  if (s === "rejected" || s === "sold" || s === "rented") return { color: colors.danger };
  return { color: colors.secondary };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  emptyAuth: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: 12, borderRadius: radius.md },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  userCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    alignItems: "center",
    ...shadow.card,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  userName: { fontSize: 18, fontWeight: "700", color: colors.text },
  userMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  roleText: { fontSize: 10, color: colors.primary, fontWeight: "700", backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  verifiedInline: { flexDirection: "row", alignItems: "center", gap: 3 },
  verifiedInlineText: { fontSize: 11, color: colors.primary, fontWeight: "600" },
  addBtn: {
    backgroundColor: colors.primary,
    marginTop: spacing.md,
    padding: 14,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  section: { marginTop: spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, textAlign: "center", padding: spacing.md, fontSize: 13 },
  listingRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    alignItems: "center",
    gap: spacing.sm,
  },
  listingImg: { width: 60, height: 60, borderRadius: radius.sm, backgroundColor: colors.border },
  listingTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  listingPrice: { fontSize: 13, color: colors.primary, fontWeight: "700", marginTop: 2 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start", marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: "700" },
  visitRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    alignItems: "center",
  },
  visitTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  visitDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  acceptBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm },
  acceptText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  rejectBtn: { borderWidth: 1, borderColor: colors.danger, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm },
  rejectText: { color: colors.danger, fontSize: 12, fontWeight: "700" },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  menuText: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
  },
  logoutText: { color: colors.danger, fontWeight: "700" },
});
