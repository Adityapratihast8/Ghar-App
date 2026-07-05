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

export default function ProfileScreen() {
  const router = useRouter();
  const { completeProfile, user } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [role, setRole] = useState<"owner" | "buyer">("buyer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async () => {
    setError("");
    if (name.trim().length < 2) {
      setError("Please enter your full name");
      return;
    }
    setLoading(true);
    try {
      await completeProfile(name.trim(), email.trim(), role);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAwareScrollView contentContainerStyle={styles.container} bottomOffset={16}>
        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.subtitle}>Tell us a bit about yourself</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          testID="name-input"
          style={styles.input}
          placeholder="e.g. Rahul Sharma"
          placeholderTextColor={colors.textLight}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Email (optional)</Text>
        <TextInput
          testID="email-input"
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={colors.textLight}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>I am a</Text>
        <View style={styles.roleRow}>
          <TouchableOpacity
            testID="role-buyer"
            style={[styles.roleCard, role === "buyer" && styles.roleCardActive]}
            onPress={() => setRole("buyer")}
          >
            <Ionicons name="search" size={28} color={role === "buyer" ? colors.primary : colors.textMuted} />
            <Text style={[styles.roleTitle, role === "buyer" && styles.roleTitleActive]}>Buyer / Tenant</Text>
            <Text style={styles.roleDesc}>Looking to buy or rent</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="role-owner"
            style={[styles.roleCard, role === "owner" && styles.roleCardActive]}
            onPress={() => setRole("owner")}
          >
            <Ionicons name="home" size={28} color={role === "owner" ? colors.primary : colors.textMuted} />
            <Text style={[styles.roleTitle, role === "owner" && styles.roleTitleActive]}>Owner</Text>
            <Text style={styles.roleDesc}>List my property</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          testID="submit-profile-button"
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: spacing.lg },
  title: { fontSize: 26, fontWeight: "800", color: colors.text, marginTop: spacing.md },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  roleRow: { flexDirection: "row", gap: spacing.md },
  roleCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: "flex-start",
    gap: 4,
  },
  roleCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  roleTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: spacing.sm },
  roleTitleActive: { color: colors.primary },
  roleDesc: { fontSize: 12, color: colors.textMuted },
  error: { color: colors.danger, marginTop: spacing.md },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
