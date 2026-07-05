import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, shadow, formatPrice } from "@/src/theme";

type Section =
  | "dashboard"
  | "listings"
  | "users"
  | "calls"
  | "messages"
  | "visits"
  | "reviews";

const SECTIONS: { key: Section; label: string; icon: any }[] = [
  { key: "dashboard", label: "Dashboard", icon: "grid" },
  { key: "listings", label: "Listings", icon: "home" },
  { key: "users", label: "Users", icon: "people" },
  { key: "calls", label: "Calls", icon: "call" },
  { key: "messages", label: "Messages", icon: "chatbubbles" },
  { key: "visits", label: "Visits", icon: "calendar" },
  { key: "reviews", label: "Reviews", icon: "star" },
];

export default function AdminScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [section, setSection] = useState<Section>("dashboard");
  const [dashboard, setDashboard] = useState<any>(null);
  const [listingStatus, setListingStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [listings, setListings] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      if (section === "dashboard") setDashboard(await api.adminDashboard().catch(() => null));
      else if (section === "listings") setListings(await api.adminList(listingStatus).catch(() => []));
      else if (section === "users") setUsers(await api.adminUsers().catch(() => []));
      else if (section === "calls") setCalls(await api.adminCallRequests().catch(() => []));
      else if (section === "messages") setMessages(await api.adminMessages().catch(() => []));
      else if (section === "visits") setVisits(await api.adminVisits().catch(() => []));
      else if (section === "reviews") setReviews(await api.adminReviews().catch(() => []));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [section, listingStatus]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  if (user?.role !== "admin") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centered}>
          <Ionicons name="lock-closed" size={48} color={colors.textLight} />
          <Text style={styles.blocked}>Admin access required</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Hero */}
      <LinearGradient
        colors={[colors.primary, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <TouchableOpacity onPress={() => router.back()} testID="admin-back" style={styles.heroBack}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Ghar.com Command Center</Text>
            <Text style={styles.heroSub}>Live business dashboard · Admin</Text>
          </View>
          <View style={styles.heroBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#fff" />
            <Text style={styles.heroBadgeText}>ADMIN</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Section chips */}
      <View style={styles.chipRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {SECTIONS.map((s) => (
            <TouchableOpacity
              key={s.key}
              testID={`admin-section-${s.key}`}
              style={[styles.chip, section === s.key && styles.chipActive]}
              onPress={() => { setLoading(true); setSection(s.key); }}
            >
              <Ionicons name={s.icon} size={13} color={section === s.key ? "#fff" : colors.text} />
              <Text style={[styles.chipText, section === s.key && styles.chipTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : section === "dashboard" ? (
          <DashboardSection data={dashboard} onOpen={setSection} />
        ) : section === "listings" ? (
          <ListingsSection
            items={listings}
            status={listingStatus}
            setStatus={setListingStatus}
            onAct={async (id, action) => {
              if (action === "approve") await api.adminApprove(id);
              else if (action === "reject") await api.adminReject(id);
              else await api.adminFeature(id, true);
              load();
            }}
            onOpen={(id) => router.push(`/property/${id}`)}
          />
        ) : section === "users" ? (
          <UsersSection users={users} />
        ) : section === "calls" ? (
          <CallsSection
            calls={calls}
            onMark={async (id, status) => { await api.adminUpdateCall(id, status); load(); }}
          />
        ) : section === "messages" ? (
          <MessagesSection messages={messages} />
        ) : section === "visits" ? (
          <VisitsSection visits={visits} />
        ) : (
          <ReviewsSection
            reviews={reviews}
            onDelete={async (id) => { await api.adminDeleteReview(id); load(); }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- Section components ----------
function DashboardSection({ data, onOpen }: { data: any; onOpen: (s: Section) => void }) {
  if (!data) return <Text style={styles.empty}>No data yet</Text>;
  const t = data.totals || {};
  const w = data.last_7_days || {};

  return (
    <View style={{ gap: spacing.md }}>
      {/* KPI Grid */}
      <View style={styles.kpiGrid}>
        <Kpi label="Users" value={t.users} icon="people" color={colors.primary} onPress={() => onOpen("users")} />
        <Kpi label="Owners" value={t.owners} icon="business" color={colors.primary} onPress={() => onOpen("users")} />
        <Kpi label="Listings" value={t.properties} icon="home" color={colors.secondary} onPress={() => onOpen("listings")} />
        <Kpi label="Pending" value={t.pending} icon="hourglass" color={colors.warning} onPress={() => onOpen("listings")} />
        <Kpi label="For Rent" value={t.rent} icon="key" color={colors.accent} onPress={() => onOpen("listings")} />
        <Kpi label="For Sale" value={t.sale} icon="cash" color={colors.primary} onPress={() => onOpen("listings")} />
        <Kpi label="Calls" value={t.calls} icon="call" color={colors.primary} onPress={() => onOpen("calls")} />
        <Kpi label="Messages" value={t.messages} icon="chatbubbles" color={colors.secondary} onPress={() => onOpen("messages")} />
        <Kpi label="Visits" value={t.visits} icon="calendar" color={colors.accent} onPress={() => onOpen("visits")} />
      </View>

      {/* Last 7 days */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="trending-up" size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Last 7 Days</Text>
        </View>
        <View style={styles.trendRow}>
          <Trend label="New users" value={w.new_users || 0} />
          <Trend label="New listings" value={w.new_properties || 0} />
          <Trend label="Calls" value={w.new_calls || 0} />
        </View>
      </View>

      {/* Top cities */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="location" size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Top Cities</Text>
        </View>
        {(data.top_cities || []).length === 0 ? (
          <Text style={styles.empty}>No data</Text>
        ) : (
          data.top_cities.map((c: any, i: number) => (
            <View key={c.city} style={styles.topRow}>
              <Text style={styles.topRank}>#{i + 1}</Text>
              <Text style={styles.topName}>{c.city}</Text>
              <View style={styles.topBarWrap}>
                <View
                  style={[
                    styles.topBar,
                    {
                      width: `${Math.min(100, (c.count / Math.max(...data.top_cities.map((x: any) => x.count))) * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.topCount}>{c.count}</Text>
            </View>
          ))
        )}
      </View>

      {/* Recent activity */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="pulse" size={18} color={colors.primary} />
          <Text style={styles.cardTitle}>Recent Activity</Text>
        </View>
        {(data.recent_calls || []).slice(0, 3).map((c: any) => (
          <View key={c.id} style={styles.activityRow}>
            <View style={[styles.actIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="call" size={14} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actTitle} numberOfLines={1}>
                {c.caller_name || "Someone"} called about {c.property_title || "a property"}
              </Text>
              <Text style={styles.actTime}>{new Date(c.created_at).toLocaleString()}</Text>
            </View>
          </View>
        ))}
        {(data.recent_visits || []).slice(0, 3).map((v: any) => (
          <View key={v.id} style={styles.activityRow}>
            <View style={[styles.actIcon, { backgroundColor: colors.accentLight }]}>
              <Ionicons name="calendar" size={14} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actTitle} numberOfLines={1}>
                Visit request scheduled ({v.status})
              </Text>
              <Text style={styles.actTime}>{new Date(v.created_at).toLocaleString()}</Text>
            </View>
          </View>
        ))}
        {(data.recent_calls || []).length === 0 && (data.recent_visits || []).length === 0 && (
          <Text style={styles.empty}>No recent activity</Text>
        )}
      </View>
    </View>
  );
}

function Kpi({ label, value, icon, color, onPress }: any) {
  return (
    <TouchableOpacity style={styles.kpi} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.kpiIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={styles.kpiVal}>{value ?? 0}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Trend({ label, value }: any) {
  return (
    <View style={styles.trendItem}>
      <Text style={styles.trendVal}>+{value}</Text>
      <Text style={styles.trendLabel}>{label}</Text>
    </View>
  );
}

function ListingsSection({ items, status, setStatus, onAct, onOpen }: any) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.statusRow}>
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <TouchableOpacity
            key={s}
            testID={`admin-status-${s}`}
            style={[styles.statusPill, status === s && styles.statusPillActive]}
            onPress={() => setStatus(s)}
          >
            <Text style={[styles.statusText, status === s && styles.statusTextActive]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {items.length === 0 ? (
        <Text style={styles.empty}>No properties in this state</Text>
      ) : (
        items.map((p: any) => (
          <View key={p.id} style={styles.rowCard}>
            <Image source={{ uri: p.images?.[0] }} style={styles.thumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{p.title}</Text>
              <Text style={styles.rowMeta}>
                {formatPrice(p.price, p.listing_type)} · {p.city}
              </Text>
              <Text style={styles.rowMeta}>{p.listing_type.toUpperCase()} · {p.category}</Text>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.btnView}
                  onPress={() => onOpen(p.id)}
                  testID={`view-${p.id}`}
                >
                  <Text style={styles.btnViewText}>View</Text>
                </TouchableOpacity>
                {status === "pending" && (
                  <>
                    <TouchableOpacity testID={`approve-${p.id}`} style={styles.btnApprove} onPress={() => onAct(p.id, "approve")}>
                      <Text style={styles.btnApproveText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID={`reject-${p.id}`} style={styles.btnReject} onPress={() => onAct(p.id, "reject")}>
                      <Text style={styles.btnRejectText}>Reject</Text>
                    </TouchableOpacity>
                  </>
                )}
                {status === "approved" && !p.featured && (
                  <TouchableOpacity testID={`feature-${p.id}`} style={styles.btnFeature} onPress={() => onAct(p.id, "feature")}>
                    <Ionicons name="star" size={11} color="#fff" />
                    <Text style={styles.btnFeatureText}>Feature</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function UsersSection({ users }: any) {
  if (users.length === 0) return <Text style={styles.empty}>No users yet</Text>;
  return (
    <View style={{ gap: spacing.sm }}>
      {users.map((u: any) => (
        <View key={u.id} style={styles.rowCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{(u.name?.[0] || "U").toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{u.name || "Anonymous"}</Text>
            <Text style={styles.rowMeta}>{u.phone}</Text>
            {u.email ? <Text style={styles.rowMetaSmall}>{u.email}</Text> : null}
            <View style={styles.tagRow}>
              <View style={[styles.roleTag, u.role === "admin" ? { backgroundColor: colors.accent } : u.role === "owner" ? { backgroundColor: colors.primary } : { backgroundColor: colors.textMuted }]}>
                <Text style={styles.roleTagText}>{u.role.toUpperCase()}</Text>
              </View>
              {u.verified ? (
                <View style={styles.verifiedTag}>
                  <Ionicons name="shield-checkmark" size={10} color={colors.primary} />
                  <Text style={styles.verifiedTagText}>Verified</Text>
                </View>
              ) : null}
              <Text style={styles.tagDate}>{new Date(u.created_at).toLocaleDateString()}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function CallsSection({ calls, onMark }: any) {
  if (calls.length === 0) return <Text style={styles.empty}>No call requests yet</Text>;
  return (
    <View style={{ gap: spacing.sm }}>
      {calls.map((c: any) => (
        <View key={c.id} style={styles.callCard}>
          <View style={styles.callHead}>
            <Ionicons name="call" size={14} color={colors.primary} />
            <Text style={styles.callTitle} numberOfLines={1}>{c.property_title}</Text>
            <View style={[styles.callStatus, callStatusStyle(c.status)]}>
              <Text style={styles.callStatusText}>{c.status.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.callInfoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.callLbl}>CALLER</Text>
              <Text style={styles.callVal}>{c.caller_name || "—"}</Text>
              <Text style={styles.callPh}>{c.caller_phone}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.callLbl}>OWNER</Text>
              <Text style={styles.callVal}>{c.owner_name || "—"}</Text>
              <Text style={styles.callPh}>{c.owner_phone}</Text>
            </View>
          </View>
          <Text style={styles.callTime}>{new Date(c.created_at).toLocaleString()}</Text>
          {c.status === "pending" && (
            <View style={styles.callActions}>
              <TouchableOpacity
                testID={`call-connected-${c.id}`}
                style={styles.btnApprove}
                onPress={() => onMark(c.id, "connected")}
              >
                <Text style={styles.btnApproveText}>Mark Connected</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`call-missed-${c.id}`}
                style={styles.btnReject}
                onPress={() => onMark(c.id, "missed")}
              >
                <Text style={styles.btnRejectText}>Missed</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function MessagesSection({ messages }: any) {
  if (messages.length === 0) return <Text style={styles.empty}>No messages yet</Text>;
  return (
    <View style={{ gap: spacing.sm }}>
      {messages.map((m: any) => (
        <View key={m.id} style={styles.msgCard}>
          <View style={styles.msgHead}>
            <Text style={styles.msgFrom}>
              {m.from_user?.name || "User"} → {m.to_user?.name || "User"}
            </Text>
            <Text style={styles.msgTime}>{new Date(m.created_at).toLocaleString()}</Text>
          </View>
          {m.property?.title ? (
            <Text style={styles.msgProp} numberOfLines={1}>📌 {m.property.title}</Text>
          ) : null}
          <Text style={styles.msgText}>{m.text}</Text>
        </View>
      ))}
    </View>
  );
}

function VisitsSection({ visits }: any) {
  if (visits.length === 0) return <Text style={styles.empty}>No visit requests yet</Text>;
  return (
    <View style={{ gap: spacing.sm }}>
      {visits.map((v: any) => (
        <View key={v.id} style={styles.visitCard}>
          <View style={styles.visitHead}>
            <Ionicons name="calendar" size={14} color={colors.accent} />
            <Text style={styles.visitProp} numberOfLines={1}>{v.property?.title || "Property"}</Text>
            <View style={[styles.callStatus, callStatusStyle(v.status)]}>
              <Text style={styles.callStatusText}>{v.status.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.callInfoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.callLbl}>BUYER</Text>
              <Text style={styles.callVal}>{v.buyer?.name || "—"}</Text>
              <Text style={styles.callPh}>{v.buyer?.phone}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.callLbl}>OWNER</Text>
              <Text style={styles.callVal}>{v.owner?.name || "—"}</Text>
              <Text style={styles.callPh}>{v.owner?.phone}</Text>
            </View>
          </View>
          <Text style={styles.visitDate}>
            Scheduled: {v.scheduled_date} · Requested {new Date(v.created_at).toLocaleDateString()}
          </Text>
          {v.message ? <Text style={styles.visitMsg}>💬 {v.message}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function ReviewsSection({ reviews, onDelete }: any) {
  if (reviews.length === 0) return <Text style={styles.empty}>No reviews yet</Text>;
  return (
    <View style={{ gap: spacing.sm }}>
      {reviews.map((r: any) => (
        <View key={r.id} style={styles.rowCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{(r.user_name?.[0] || "U").toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.rowTitle}>{r.user_name || "User"}</Text>
              <TouchableOpacity testID={`del-review-${r.id}`} onPress={() => onDelete(r.id)}>
                <Ionicons name="trash" size={16} color={colors.danger} />
              </TouchableOpacity>
            </View>
            <View style={styles.starsInline}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons
                  key={s}
                  name={s <= r.rating ? "star" : "star-outline"}
                  size={12}
                  color={colors.secondary}
                />
              ))}
              <Text style={styles.rowMetaSmall}>
                · {r.property?.title || "Property"}
              </Text>
            </View>
            {r.comment ? <Text style={styles.rowMeta}>{r.comment}</Text> : null}
            <Text style={styles.tagDate}>{new Date(r.created_at).toLocaleString()}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function callStatusStyle(status: string) {
  if (status === "accepted" || status === "connected") return { backgroundColor: colors.primary };
  if (status === "missed" || status === "rejected") return { backgroundColor: colors.danger };
  return { backgroundColor: colors.warning };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  blocked: { fontSize: 16, color: colors.textMuted },
  hero: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  heroBack: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  heroTitle: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
  heroBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
  },
  heroBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  chipRowWrap: { paddingVertical: spacing.md, height: 56, backgroundColor: colors.background },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  chip: {
    flexShrink: 0, height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row", alignItems: "center", gap: 4,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  kpi: {
    width: "31.5%",
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radius.md,
    ...shadow.card,
  },
  kpiIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  kpiVal: { fontSize: 18, fontWeight: "800", color: colors.text },
  kpiLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    ...shadow.card,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.sm },
  cardTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  trendRow: { flexDirection: "row", justifyContent: "space-around" },
  trendItem: { alignItems: "center", flex: 1 },
  trendVal: { fontSize: 22, fontWeight: "800", color: colors.primary },
  trendLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: "center" },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.sm },
  topRank: { fontSize: 12, fontWeight: "800", color: colors.textMuted, width: 20 },
  topName: { fontSize: 13, fontWeight: "600", color: colors.text, width: 90 },
  topBarWrap: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" },
  topBar: { height: 6, backgroundColor: colors.primary },
  topCount: { fontSize: 12, fontWeight: "700", color: colors.primary, width: 26, textAlign: "right" },
  activityRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center", paddingVertical: 6 },
  actIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  actTitle: { fontSize: 13, color: colors.text, fontWeight: "500" },
  actTime: { fontSize: 10, color: colors.textLight, marginTop: 2 },
  empty: { textAlign: "center", color: colors.textMuted, padding: spacing.lg, fontSize: 13 },
  statusRow: { flexDirection: "row", gap: 6, marginBottom: spacing.sm },
  statusPill: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  statusPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusText: { fontSize: 12, color: colors.text, fontWeight: "600" },
  statusTextActive: { color: "#fff" },
  rowCard: {
    flexDirection: "row", gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md, borderRadius: radius.md,
    ...shadow.card,
  },
  thumb: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: colors.border },
  rowTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowMetaSmall: { fontSize: 11, color: colors.textLight },
  actionsRow: { flexDirection: "row", gap: 6, marginTop: spacing.sm, flexWrap: "wrap" },
  btnView: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  btnViewText: { fontSize: 11, color: colors.text, fontWeight: "600" },
  btnApprove: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.primary },
  btnApproveText: { fontSize: 11, color: "#fff", fontWeight: "700" },
  btnReject: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.danger },
  btnRejectText: { fontSize: 11, color: "#fff", fontWeight: "700" },
  btnFeature: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.secondary, flexDirection: "row", alignItems: "center", gap: 3 },
  btnFeatureText: { fontSize: 11, color: "#fff", fontWeight: "700" },
  userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  userAvatarText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, flexWrap: "wrap" },
  roleTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  roleTagText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  verifiedTag: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: colors.primaryLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  verifiedTagText: { color: colors.primary, fontSize: 9, fontWeight: "700" },
  tagDate: { fontSize: 10, color: colors.textLight, marginLeft: 4 },
  callCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: 6,
    ...shadow.card,
  },
  callHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  callTitle: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.text },
  callStatus: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  callStatusText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  callInfoRow: { flexDirection: "row", gap: spacing.md, marginTop: 4 },
  callLbl: { fontSize: 9, color: colors.textMuted, fontWeight: "700", letterSpacing: 0.5 },
  callVal: { fontSize: 13, color: colors.text, fontWeight: "600", marginTop: 2 },
  callPh: { fontSize: 11, color: colors.textMuted },
  callTime: { fontSize: 10, color: colors.textLight, marginTop: 4 },
  callActions: { flexDirection: "row", gap: 6, marginTop: 6 },
  msgCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    ...shadow.card,
  },
  msgHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  msgFrom: { fontSize: 12, color: colors.primary, fontWeight: "700" },
  msgTime: { fontSize: 10, color: colors.textLight },
  msgProp: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  msgText: { fontSize: 13, color: colors.text, marginTop: 6, lineHeight: 20 },
  visitCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: 4,
    ...shadow.card,
  },
  visitHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  visitProp: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.text },
  visitDate: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  visitMsg: { fontSize: 12, color: colors.text, marginTop: 4, fontStyle: "italic" },
  starsInline: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 },
});
