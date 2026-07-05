import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, shadow, formatPrice } from "@/src/theme";

const AMENITY_ICONS: Record<string, any> = {
  Lift: "arrow-up-circle",
  Parking: "car",
  CCTV: "videocam",
  Gym: "barbell",
  "Power Backup": "flash",
  "Water Supply": "water",
  WiFi: "wifi",
  Garden: "leaf",
  "Swimming Pool": "water-outline",
};

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [prop, setProp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [showVisit, setShowVisit] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [visitMsg, setVisitMsg] = useState("");
  const [chatText, setChatText] = useState("");
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const p = await api.getProperty(String(id));
        setProp(p);
        if (user) {
          const wish = await api.getWishlist().catch(() => []);
          setSaved(!!wish.find((w: any) => w.id === p.id));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user]);

  const toggleSave = async () => {
    if (!user) return router.push("/auth/phone");
    try {
      if (saved) {
        await api.removeWishlist(prop.id);
        setSaved(false);
      } else {
        await api.addWishlist(prop.id);
        setSaved(true);
      }
    } catch {}
  };

  const submitVisit = async () => {
    if (!user) return router.push("/auth/phone");
    if (!visitDate.trim()) {
      setToast("Please enter a date");
      return;
    }
    try {
      await api.createVisit(prop.id, visitDate, visitMsg);
      setShowVisit(false);
      setVisitDate("");
      setVisitMsg("");
      setToast("Visit request sent!");
      setTimeout(() => setToast(""), 2500);
    } catch (e: any) {
      setToast(e.message || "Failed");
    }
  };

  const sendFirstMessage = async () => {
    if (!user) return router.push("/auth/phone");
    if (!chatText.trim()) return;
    try {
      await api.sendMessage(prop.id, prop.owner.id, chatText);
      setShowChat(false);
      router.push({
        pathname: "/chat/[thread]",
        params: {
          thread: "new",
          property_id: prop.id,
          other_user_id: prop.owner.id,
          other_name: prop.owner.name,
          property_title: prop.title,
        },
      });
      setChatText("");
    } catch (e: any) {
      setToast(e.message || "Failed to send");
    }
  };

  const callOwner = () => {
    if (!prop?.owner?.phone) return;
    Linking.openURL(`tel:${prop.owner.phone}`).catch(() => {});
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (!prop) {
    return (
      <View style={styles.loader}>
        <Text>Property not found</Text>
      </View>
    );
  }

  const isOwner = user?.id === prop.owner_id;

  return (
    <View style={styles.wrap}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* Image gallery */}
        <View style={styles.gallery}>
          <Image source={{ uri: prop.images?.[imgIdx] }} style={styles.mainImg} />
          <SafeAreaView style={styles.galleryOverlay} edges={["top"]}>
            <View style={styles.galleryHeader}>
              <TouchableOpacity testID="back-btn" style={styles.iconBtn} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <TouchableOpacity testID="save-btn" style={styles.iconBtn} onPress={toggleSave}>
                  <Ionicons name={saved ? "heart" : "heart-outline"} size={22} color={saved ? colors.danger : "#fff"} />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
          {prop.images?.length > 1 && (
            <View style={styles.dots}>
              {prop.images.map((_: any, i: number) => (
                <TouchableOpacity key={i} onPress={() => setImgIdx(i)}>
                  <View style={[styles.dot, i === imgIdx && styles.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.imgBadges}>
            <View style={[styles.badge, { backgroundColor: prop.listing_type === "rent" ? colors.secondary : colors.primary }]}>
              <Text style={styles.badgeText}>{prop.listing_type === "rent" ? "FOR RENT" : "FOR SALE"}</Text>
            </View>
            {prop.verified && (
              <View style={[styles.badge, { backgroundColor: colors.success }]}>
                <Ionicons name="shield-checkmark" size={11} color="#fff" />
                <Text style={styles.badgeText}>VERIFIED</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.priceText}>{formatPrice(prop.price, prop.listing_type)}</Text>
          {prop.listing_type === "rent" && prop.security_deposit > 0 && (
            <Text style={styles.deposit}>+ ₹{prop.security_deposit.toLocaleString()} deposit</Text>
          )}
          <Text style={styles.title}>{prop.title}</Text>
          <View style={styles.locRow}>
            <Ionicons name="location" size={14} color={colors.textMuted} />
            <Text style={styles.locText}>
              {prop.locality}, {prop.city}, {prop.state}
            </Text>
          </View>

          {/* Key stats */}
          <View style={styles.stats}>
            {prop.bedrooms > 0 && <Stat icon="bed" label={`${prop.bedrooms} BHK`} />}
            {prop.bathrooms > 0 && <Stat icon="water" label={`${prop.bathrooms} Baths`} />}
            {prop.area > 0 && <Stat icon="resize" label={`${prop.area} sqft`} />}
            <Stat icon="business" label={prop.furnishing} />
          </View>

          {/* Description */}
          <Text style={styles.sectionTitle}>About This Property</Text>
          <Text style={styles.desc}>{prop.description || "No description provided."}</Text>

          {/* Amenities */}
          {prop.amenities?.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.amenities}>
                {prop.amenities.map((a: string) => (
                  <View key={a} style={styles.amenityChip}>
                    <Ionicons name={(AMENITY_ICONS[a] as any) || "checkmark-circle"} size={14} color={colors.primary} />
                    <Text style={styles.amenityText}>{a}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Owner card */}
          {prop.owner && (
            <>
              <Text style={styles.sectionTitle}>Listed by Owner</Text>
              <View style={styles.ownerCard}>
                <View style={styles.ownerAvatar}>
                  <Ionicons name="person" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ownerName}>{prop.owner.name || "Owner"}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="shield-checkmark" size={12} color={colors.primary} />
                    <Text style={styles.ownerMeta}>Verified Owner</Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      {!isOwner && (
        <View style={[styles.cta, { paddingBottom: insets.bottom + spacing.sm }]}>
          <TouchableOpacity testID="call-owner-btn" style={styles.ctaSecondary} onPress={callOwner}>
            <Ionicons name="call" size={18} color={colors.primary} />
            <Text style={styles.ctaSecondaryText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="chat-owner-btn" style={styles.ctaSecondary} onPress={() => setShowChat(true)}>
            <Ionicons name="chatbubbles" size={18} color={colors.primary} />
            <Text style={styles.ctaSecondaryText}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="schedule-visit-btn" style={styles.ctaPrimary} onPress={() => setShowVisit(true)}>
            <Ionicons name="calendar" size={18} color="#fff" />
            <Text style={styles.ctaPrimaryText}>Schedule Visit</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Visit modal */}
      <Modal visible={showVisit} transparent animationType="slide" onRequestClose={() => setShowVisit(false)}>
        <View style={styles.overlay}>
          <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} bottomOffset={16}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Schedule a Visit</Text>
                <TouchableOpacity onPress={() => setShowVisit(false)}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>
              <Text style={styles.label}>Preferred Date</Text>
              <TextInput
                testID="visit-date-input"
                style={styles.input}
                placeholder="e.g. 2026-03-15"
                placeholderTextColor={colors.textLight}
                value={visitDate}
                onChangeText={setVisitDate}
              />
              <Text style={styles.label}>Message (optional)</Text>
              <TextInput
                testID="visit-msg-input"
                style={[styles.input, { height: 80 }]}
                placeholder="Any specific timing or questions..."
                placeholderTextColor={colors.textLight}
                value={visitMsg}
                onChangeText={setVisitMsg}
                multiline
              />
              <TouchableOpacity testID="submit-visit-btn" style={styles.submitBtn} onPress={submitVisit}>
                <Text style={styles.submitText}>Send Request</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
        </View>
      </Modal>

      {/* Chat init modal */}
      <Modal visible={showChat} transparent animationType="slide" onRequestClose={() => setShowChat(false)}>
        <View style={styles.overlay}>
          <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }} bottomOffset={16}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Message Owner</Text>
                <TouchableOpacity onPress={() => setShowChat(false)}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>
              <TextInput
                testID="chat-init-input"
                style={[styles.input, { height: 100 }]}
                placeholder="Hi, I'm interested in this property..."
                placeholderTextColor={colors.textLight}
                value={chatText}
                onChangeText={setChatText}
                multiline
              />
              <TouchableOpacity testID="send-chat-btn" style={styles.submitBtn} onPress={sendFirstMessage}>
                <Text style={styles.submitText}>Send Message</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
        </View>
      </Modal>

      {toast ? (
        <View style={[styles.toast, { bottom: insets.bottom + 100 }]} testID="detail-toast">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Stat({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.statText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  gallery: { height: 320, backgroundColor: colors.border, position: "relative" },
  mainImg: { width: "100%", height: "100%" },
  galleryOverlay: { position: "absolute", top: 0, left: 0, right: 0 },
  galleryHeader: { flexDirection: "row", justifyContent: "space-between", padding: spacing.md },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  dots: { position: "absolute", bottom: 12, alignSelf: "center", flexDirection: "row", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.6)" },
  dotActive: { backgroundColor: "#fff", width: 20 },
  imgBadges: { position: "absolute", top: 60, left: spacing.md, flexDirection: "row", gap: 6 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  body: {
    backgroundColor: colors.surface,
    marginTop: -spacing.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  priceText: { fontSize: 26, fontWeight: "800", color: colors.text },
  deposit: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  title: { fontSize: 18, fontWeight: "600", color: colors.text, marginTop: spacing.sm },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  locText: { fontSize: 13, color: colors.textMuted },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
  },
  stat: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: "45%" },
  statText: { fontSize: 13, color: colors.text, fontWeight: "600", textTransform: "capitalize" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  desc: { fontSize: 14, color: colors.textMuted, lineHeight: 22 },
  amenities: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  amenityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  amenityText: { fontSize: 12, color: colors.primary, fontWeight: "600" },
  ownerCard: {
    flexDirection: "row",
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.md,
    alignItems: "center",
  },
  ownerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  ownerName: { fontSize: 15, fontWeight: "700", color: colors.text },
  ownerMeta: { fontSize: 12, color: colors.textMuted },
  cta: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    flexDirection: "row",
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadow.strong,
  },
  ctaSecondary: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ctaSecondaryText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  ctaPrimary: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  ctaPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: spacing.md, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  submitBtn: { backgroundColor: colors.primary, borderRadius: radius.md, padding: 14, alignItems: "center", marginTop: spacing.md },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  toast: { position: "absolute", left: 20, right: 20, backgroundColor: colors.text, padding: 12, borderRadius: radius.md, alignItems: "center" },
  toastText: { color: "#fff", fontWeight: "600" },
});
