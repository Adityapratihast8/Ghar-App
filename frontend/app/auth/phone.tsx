import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius } from "@/src/theme";

export default function PhoneScreen() {
  const router = useRouter();
  const { sendOtp } = useAuth();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onContinue = async () => {
    setError("");
    const clean = phone.replace(/\D/g, "");
    if (clean.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }
    setLoading(true);
    try {
      await sendOtp(`+91${clean}`);
      router.push({ pathname: "/auth/otp", params: { phone: `+91${clean}` } });
    } catch (e: any) {
      setError(e.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAwareScrollView contentContainerStyle={styles.container} bottomOffset={16}>
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Ionicons name="home" size={40} color={colors.primary} />
          </View>
          <Text style={styles.brand} testID="brand-title">Ghar.com</Text>
          <Text style={styles.tagline}>India&apos;s No-Broker Property Platform</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Mobile Number</Text>
          <View style={styles.phoneRow}>
            <View style={styles.prefix}>
              <Text style={styles.prefixText}>+91</Text>
            </View>
            <TextInput
              testID="phone-input"
              style={styles.input}
              placeholder="10-digit mobile number"
              placeholderTextColor={colors.textLight}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
              autoFocus
            />
          </View>
          {error ? (
            <Text style={styles.error} testID="phone-error">
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            testID="send-otp-button"
            style={[styles.button, (!phone || loading) && styles.buttonDisabled]}
            onPress={onContinue}
            disabled={!phone || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hint} testID="demo-hint">
            Demo mode: OTP will always be 123456
          </Text>
        </View>

        <View style={styles.features}>
          <FeatureRow icon="shield-checkmark" text="Verified listings only" />
          <FeatureRow icon="close-circle" text="No brokers, ever" />
          <FeatureRow icon="chatbubbles" text="Chat directly with owners" />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

function FeatureRow({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.featureRow}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: spacing.lg, justifyContent: "space-between" },
  logoWrap: { alignItems: "center", marginTop: spacing.xl },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  brand: { fontSize: 32, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  form: { marginTop: spacing.xl },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: spacing.sm },
  phoneRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  prefix: {
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.background,
  },
  prefixText: { fontSize: 16, color: colors.text, fontWeight: "600" },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.danger, marginTop: spacing.sm, fontSize: 13 },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: "center", marginTop: spacing.md },
  features: { marginBottom: spacing.lg, gap: spacing.sm },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  featureText: { fontSize: 14, color: colors.text },
});
