import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme";

const CATEGORIES = [
  { key: "apartment", label: "Apartment", type: "residential" },
  { key: "villa", label: "Villa", type: "residential" },
  { key: "builder_floor", label: "Builder Floor", type: "residential" },
  { key: "pg", label: "PG / Hostel", type: "residential" },
  { key: "shop", label: "Shop", type: "commercial" },
  { key: "office", label: "Office", type: "commercial" },
  { key: "warehouse", label: "Warehouse", type: "commercial" },
  { key: "plot", label: "Plot", type: "land" },
];

const AMENITIES = ["Lift", "Parking", "CCTV", "Gym", "Power Backup", "Water Supply", "WiFi", "Garden", "Swimming Pool"];

export default function AddPropertyScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [priceSuggest, setPriceSuggest] = useState<any>(null);
  const [duplicates, setDuplicates] = useState<any[]>([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    listing_type: "rent" as "rent" | "sale",
    category: "apartment",
    property_type: "residential",
    price: "",
    security_deposit: "",
    state: "",
    city: "",
    locality: "",
    pincode: "",
    bedrooms: "",
    bathrooms: "",
    area: "",
    furnishing: "unfurnished",
    amenities: [] as string[],
    ready_to_move: true,
  });

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const toggleAmenity = (a: string) => {
    set("amenities", form.amenities.includes(a) ? form.amenities.filter((x) => x !== a) : [...form.amenities, a]);
  };

  const pickImages = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      setError("Photo library permission is needed to add photos");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.6,
      base64: true,
      selectionLimit: 8 - images.length,
    });
    if (res.canceled) return;
    const newImgs = res.assets
      .map((a) => (a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri))
      .filter(Boolean);
    setImages([...images, ...newImgs].slice(0, 8));
    setError("");
  };

  const removeImage = (idx: number) => {
    setImages(images.filter((_, i) => i !== idx));
  };

  const suggestPrice = async () => {
    if (!form.city || !form.locality || !form.area) {
      setError("Fill city, locality and area first for price suggestion");
      return;
    }
    setPriceLoading(true);
    setError("");
    try {
      const res = await api.priceSuggest({
        city: form.city,
        locality: form.locality,
        category: form.category,
        listing_type: form.listing_type,
        area: parseFloat(form.area) || 0,
        bedrooms: parseInt(form.bedrooms) || 0,
      });
      setPriceSuggest(res);
      if (res.estimated_total_min && !form.price) {
        // pre-fill with lower bound
        set("price", String(res.estimated_total_min));
      }
    } catch (e: any) {
      setError(e.message || "Price suggestion failed");
    } finally {
      setPriceLoading(false);
    }
  };

  const generateAI = async () => {
    if (!form.title || !form.city) {
      setError("Enter title and city first");
      return;
    }
    setAiLoading(true);
    setError("");
    try {
      const res = await api.generateDescription({
        title: form.title,
        category: form.category,
        listing_type: form.listing_type,
        bedrooms: parseInt(form.bedrooms) || 0,
        area: parseFloat(form.area) || 0,
        city: form.city,
        locality: form.locality,
        amenities: form.amenities,
        price: parseFloat(form.price) || 0,
      });
      set("description", res.description);
    } catch (e: any) {
      setError(e.message || "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  };

  const submit = async () => {
    setError("");
    if (images.length === 0) {
      setError("Please upload at least 1 photo of your property");
      setStep(3);
      return;
    }
    setSaving(true);
    try {
      // Duplicate check
      const dup = await api.checkDuplicate({
        title: form.title,
        city: form.city,
        locality: form.locality,
        bedrooms: parseInt(form.bedrooms) || 0,
      }).catch(() => ({ duplicate: false, matches: [] }));
      if (dup.duplicate && duplicates.length === 0) {
        setDuplicates(dup.matches || []);
        setError("Similar listings detected. Please review below before submitting.");
        setSaving(false);
        return;
      }
      const payload = {
        title: form.title,
        description: form.description,
        listing_type: form.listing_type,
        category: form.category,
        property_type: CATEGORIES.find((c) => c.key === form.category)?.type || "residential",
        price: parseFloat(form.price) || 0,
        security_deposit: parseFloat(form.security_deposit) || 0,
        state: form.state,
        city: form.city,
        locality: form.locality,
        pincode: form.pincode,
        bedrooms: parseInt(form.bedrooms) || 0,
        bathrooms: parseInt(form.bathrooms) || 0,
        area: parseFloat(form.area) || 0,
        furnishing: form.furnishing,
        amenities: form.amenities,
        images,
        ready_to_move: form.ready_to_move,
      };
      await api.createProperty(payload);
      router.replace("/(tabs)/profile");
    } catch (e: any) {
      setError(e.message || "Failed to create property");
    } finally {
      setSaving(false);
    }
  };

  const canNext =
    (step === 1 && form.title && form.city && form.locality) ||
    (step === 2 && form.price) ||
    step === 3;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="add-back-btn" onPress={() => (step > 1 ? setStep(step - 1) : router.back())}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>List Property</Text>
        <Text style={styles.step}>Step {step}/3</Text>
      </View>

      <View style={styles.progress}>
        <View style={[styles.progressBar, { width: `${(step / 3) * 100}%` }]} />
      </View>

      <KeyboardAwareScrollView style={styles.scroll} contentContainerStyle={{ padding: spacing.lg }} bottomOffset={100}>
        {step === 1 && (
          <>
            <Text style={styles.sectionTitle}>Basic Details</Text>

            <Text style={styles.label}>I want to</Text>
            <View style={styles.chipRow}>
              {(["rent", "sale"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  testID={`listing-${t}`}
                  style={[styles.selectChip, form.listing_type === t && styles.selectChipActive]}
                  onPress={() => set("listing_type", t)}
                >
                  <Text style={[styles.selectChipText, form.listing_type === t && styles.selectChipTextActive]}>
                    {t === "rent" ? "Rent Out" : "Sell"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Property Type</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  testID={`cat-${c.key}`}
                  style={[styles.selectChip, form.category === c.key && styles.selectChipActive]}
                  onPress={() => set("category", c.key)}
                >
                  <Text style={[styles.selectChipText, form.category === c.key && styles.selectChipTextActive]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Title *</Text>
            <TextInput
              testID="title-input"
              style={styles.input}
              placeholder="e.g. Spacious 2BHK in Andheri"
              placeholderTextColor={colors.textLight}
              value={form.title}
              onChangeText={(v) => set("title", v)}
            />

            <Text style={styles.label}>City *</Text>
            <TextInput
              testID="city-input"
              style={styles.input}
              placeholder="e.g. Mumbai"
              placeholderTextColor={colors.textLight}
              value={form.city}
              onChangeText={(v) => set("city", v)}
            />

            <Text style={styles.label}>Locality *</Text>
            <TextInput
              testID="locality-input"
              style={styles.input}
              placeholder="e.g. Andheri West"
              placeholderTextColor={colors.textLight}
              value={form.locality}
              onChangeText={(v) => set("locality", v)}
            />

            <Text style={styles.label}>State</Text>
            <TextInput
              testID="state-input"
              style={styles.input}
              placeholder="e.g. Maharashtra"
              placeholderTextColor={colors.textLight}
              value={form.state}
              onChangeText={(v) => set("state", v)}
            />

            <Text style={styles.label}>Pincode</Text>
            <TextInput
              testID="pincode-input"
              style={styles.input}
              placeholder="e.g. 400058"
              placeholderTextColor={colors.textLight}
              value={form.pincode}
              onChangeText={(v) => set("pincode", v)}
              keyboardType="numeric"
            />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.sectionTitle}>Property Details</Text>

            {/* AI Price Suggestion */}
            <TouchableOpacity
              testID="price-suggest-btn"
              style={styles.aiPriceBtn}
              onPress={suggestPrice}
              disabled={priceLoading}
            >
              {priceLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={16} color={colors.primary} />
                  <Text style={styles.aiPriceText}>Get AI Price Suggestion</Text>
                </>
              )}
            </TouchableOpacity>
            {priceSuggest ? (
              <View style={styles.priceHintBox}>
                <Text style={styles.priceHintTitle}>
                  Suggested range: ₹{(priceSuggest.per_sqft_min ?? "?")}-{(priceSuggest.per_sqft_max ?? "?")} / sqft
                </Text>
                {priceSuggest.estimated_total_min ? (
                  <Text style={styles.priceHintTotal}>
                    Estimated total: ₹{Number(priceSuggest.estimated_total_min).toLocaleString()} - ₹{Number(priceSuggest.estimated_total_max).toLocaleString()}
                  </Text>
                ) : null}
                {priceSuggest.note ? (
                  <Text style={styles.priceHintNote}>{priceSuggest.note}</Text>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.label}>
              {form.listing_type === "rent" ? "Monthly Rent (₹) *" : "Price (₹) *"}
            </Text>
            <TextInput
              testID="price-input"
              style={styles.input}
              placeholder="e.g. 25000"
              placeholderTextColor={colors.textLight}
              value={form.price}
              onChangeText={(v) => set("price", v)}
              keyboardType="numeric"
            />

            {form.listing_type === "rent" && (
              <>
                <Text style={styles.label}>Security Deposit (₹)</Text>
                <TextInput
                  testID="deposit-input"
                  style={styles.input}
                  placeholder="e.g. 75000"
                  placeholderTextColor={colors.textLight}
                  value={form.security_deposit}
                  onChangeText={(v) => set("security_deposit", v)}
                  keyboardType="numeric"
                />
              </>
            )}

            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Bedrooms</Text>
                <TextInput
                  testID="bedrooms-input"
                  style={styles.input}
                  placeholder="e.g. 2"
                  placeholderTextColor={colors.textLight}
                  value={form.bedrooms}
                  onChangeText={(v) => set("bedrooms", v)}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Bathrooms</Text>
                <TextInput
                  testID="bathrooms-input"
                  style={styles.input}
                  placeholder="e.g. 2"
                  placeholderTextColor={colors.textLight}
                  value={form.bathrooms}
                  onChangeText={(v) => set("bathrooms", v)}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={styles.label}>Area (sqft)</Text>
            <TextInput
              testID="area-input"
              style={styles.input}
              placeholder="e.g. 1100"
              placeholderTextColor={colors.textLight}
              value={form.area}
              onChangeText={(v) => set("area", v)}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Furnishing</Text>
            <View style={styles.chipRow}>
              {["unfurnished", "semi-furnished", "furnished"].map((f) => (
                <TouchableOpacity
                  key={f}
                  testID={`furnish-${f}`}
                  style={[styles.selectChip, form.furnishing === f && styles.selectChipActive]}
                  onPress={() => set("furnishing", f)}
                >
                  <Text style={[styles.selectChipText, form.furnishing === f && styles.selectChipTextActive]}>
                    {f.replace("-", " ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.sectionTitle}>Photos, Amenities & Description</Text>

            {/* Image picker */}
            <Text style={styles.label}>Property Photos * (upto 8)</Text>
            <View style={styles.imagesGrid}>
              {images.map((img, i) => (
                <View key={i} style={styles.imgTile}>
                  <Image source={{ uri: img }} style={styles.imgTileImg} />
                  <TouchableOpacity
                    testID={`remove-img-${i}`}
                    style={styles.imgRemove}
                    onPress={() => removeImage(i)}
                  >
                    <Ionicons name="close" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 8 && (
                <TouchableOpacity testID="pick-images-btn" style={styles.imgAdd} onPress={pickImages}>
                  <Ionicons name="add" size={26} color={colors.primary} />
                  <Text style={styles.imgAddText}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            {duplicates.length > 0 ? (
              <View style={styles.dupBox}>
                <View style={styles.dupHeader}>
                  <Ionicons name="warning" size={16} color={colors.warning} />
                  <Text style={styles.dupTitle}>Similar listings already exist</Text>
                </View>
                {duplicates.map((d: any) => (
                  <Text key={d.id} style={styles.dupItem}>
                    · {d.title} — {d.locality}, {d.city} ({Math.round((d.similarity || 0) * 100)}% match)
                  </Text>
                ))}
                <Text style={styles.dupHint}>
                  If your listing is genuinely different, tap Submit again to proceed.
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>Amenities</Text>
            <View style={styles.chipRow}>
              {AMENITIES.map((a) => (
                <TouchableOpacity
                  key={a}
                  testID={`amenity-${a}`}
                  style={[styles.selectChip, form.amenities.includes(a) && styles.selectChipActive]}
                  onPress={() => toggleAmenity(a)}
                >
                  <Text style={[styles.selectChipText, form.amenities.includes(a) && styles.selectChipTextActive]}>
                    {a}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.aiRow}>
              <Text style={styles.label}>Description</Text>
              <TouchableOpacity testID="ai-generate-btn" onPress={generateAI} disabled={aiLoading} style={styles.aiBtn}>
                {aiLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={14} color="#fff" />
                    <Text style={styles.aiBtnText}>Generate with AI</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <TextInput
              testID="description-input"
              style={[styles.input, { height: 120, textAlignVertical: "top" }]}
              placeholder="Describe your property..."
              placeholderTextColor={colors.textLight}
              value={form.description}
              onChangeText={(v) => set("description", v)}
              multiline
            />
            <Text style={styles.note}>
              Your listing will be reviewed by our team before going live. AI checks for duplicates automatically.
            </Text>
          </>
        )}

        {error ? (
          <Text style={styles.error} testID="add-error">
            {error}
          </Text>
        ) : null}
      </KeyboardAwareScrollView>

      <View style={styles.footer}>
        {step < 3 ? (
          <TouchableOpacity
            testID="next-btn"
            style={[styles.footerBtn, !canNext && styles.disabled]}
            onPress={() => canNext && setStep(step + 1)}
            disabled={!canNext}
          >
            <Text style={styles.footerBtnText}>Next</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity testID="submit-btn" style={styles.footerBtn} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.footerBtnText}>Submit for Review</Text>}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.md },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.text, flex: 1 },
  step: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  progress: { height: 3, backgroundColor: colors.border },
  progressBar: { height: 3, backgroundColor: colors.primary },
  scroll: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginTop: spacing.md, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 4 },
  selectChip: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  selectChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectChipText: { fontSize: 13, color: colors.text, fontWeight: "600" },
  selectChipTextActive: { color: "#fff" },
  rowInputs: { flexDirection: "row", gap: spacing.md },
  aiRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  aiBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.secondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm },
  aiBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  note: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md, lineHeight: 18 },
  error: { color: colors.danger, marginTop: spacing.md, textAlign: "center" },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  footerBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  disabled: { opacity: 0.5 },
  footerBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  aiPriceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: "dashed",
    borderRadius: radius.md,
    paddingVertical: 12,
    marginBottom: spacing.sm,
  },
  aiPriceText: { color: colors.primary, fontWeight: "700", fontSize: 14 },
  priceHintBox: {
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  priceHintTitle: { fontSize: 14, fontWeight: "700", color: colors.primary },
  priceHintTotal: { fontSize: 13, color: colors.text, marginTop: 4 },
  priceHintNote: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontStyle: "italic" },
  imagesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.md },
  imgTile: { width: "31%", aspectRatio: 1, position: "relative", borderRadius: radius.md, overflow: "hidden" },
  imgTileImg: { width: "100%", height: "100%" },
  imgRemove: {
    position: "absolute",
    top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center", justifyContent: "center",
  },
  imgAdd: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    gap: 2,
  },
  imgAddText: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  dupBox: {
    backgroundColor: "#FEF3C7",
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  dupHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  dupTitle: { fontSize: 13, fontWeight: "700", color: "#92400E" },
  dupItem: { fontSize: 12, color: "#92400E", marginTop: 4 },
  dupHint: { fontSize: 11, color: colors.textMuted, marginTop: 6, fontStyle: "italic" },
});
