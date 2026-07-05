import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius } from "@/src/theme";

export default function OtpScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { verifyOtp } = useAuth();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const refs = useRef<Array<TextInput | null>>([]);

  const onChange = (i: number, v: string) => {
    const val = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    if (val && i < 5) refs.current[i + 1]?.focus();
    if (!val && i > 0) refs.current[i - 1]?.focus();
  };

  useEffect(() => {
    if (digits.every((d) => d !== "")) {
      handleVerify(digits.join(""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  const handleVerify = async (code: string) => {
    setError("");
    setLoading(true);
    try {
      const res = await verifyOtp(String(phone), code);
      if (res.is_new || !res.user.profile_complete) {
        router.replace("/auth/profile");
      } else {
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      setError(e.message || "Invalid OTP");
      setDigits(["", "", "", "", "", ""]);
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAwareScrollView contentContainerStyle={styles.container} bottomOffset={16}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>
          We&apos;ve sent a 6-digit code to <Text style={styles.phoneText}>{phone}</Text>
        </Text>

        <View style={styles.otpRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              testID={`otp-input-${i}`}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              onChangeText={(v) => onChange(i, v)}
              keyboardType="number-pad"
              maxLength={1}
              style={[styles.otpBox, d && styles.otpBoxFilled]}
              autoFocus={i === 0}
            />
          ))}
        </View>

        {error ? (
          <Text style={styles.error} testID="otp-error">
            {error}
          </Text>
        ) : null}

        {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />}

        <Text style={styles.hint}>Demo OTP: 123456</Text>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: spacing.lg },
  back: { padding: spacing.xs, marginBottom: spacing.md },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginTop: spacing.md },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 20 },
  phoneText: { color: colors.text, fontWeight: "600" },
  otpRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xl },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  otpBoxFilled: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  error: { color: colors.danger, marginTop: spacing.md, textAlign: "center" },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: "center", marginTop: spacing.lg },
});
