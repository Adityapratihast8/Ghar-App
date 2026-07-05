import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius, shadow } from "@/src/theme";

type Msg = { id: string; role: "user" | "assistant"; text: string };

const SUGGESTIONS = [
  "Best areas for 2 BHK in Bengaluru?",
  "How much is stamp duty in Mumbai?",
  "Rent agreement format?",
  "Home loan eligibility basics",
];

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AssistantScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const sessionRef = useRef<string>(`ghar-${user?.id || "anon"}-${Date.now()}`);
  const listRef = useRef<FlatList>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Namaste! 🙏 I'm Ghar Assistant. Ask me anything about property search, rent agreements, home loans, or how Ghar Connect works. How can I help you today?",
    },
  ]);

  const send = async (msg?: string) => {
    const body = (msg ?? text).trim();
    if (!body || sending) return;
    if (!user) {
      router.push("/auth/phone");
      return;
    }
    const userMsg: Msg = { id: newId(), role: "user", text: body };
    setMessages((p) => [...p, userMsg]);
    setText("");
    setSending(true);
    try {
      const res = await api.chatBot(sessionRef.current, body);
      setMessages((p) => [...p, { id: newId(), role: "assistant", text: res.reply }]);
    } catch (e: any) {
      setMessages((p) => [
        ...p,
        {
          id: newId(),
          role: "assistant",
          text: `Sorry, I'm having trouble responding right now. ${e.message || ""}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="assistant-back">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.botAvatar}>
            <Ionicons name="sparkles" size={16} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Ghar Assistant</Text>
            <Text style={styles.headerSub}>Powered by AI · Always online</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={insets.top}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messagesList}
          renderItem={({ item }) => {
            const mine = item.role === "user";
            return (
              <View style={[styles.bubbleRow, mine ? styles.rowRight : styles.rowLeft]}>
                {!mine && (
                  <View style={styles.miniBot}>
                    <Ionicons name="sparkles" size={12} color="#fff" />
                  </View>
                )}
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleBot]}>
                  <Text style={[styles.msgText, mine && { color: "#fff" }]}>{item.text}</Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={
            sending ? (
              <View style={[styles.bubbleRow, styles.rowLeft]}>
                <View style={styles.miniBot}>
                  <Ionicons name="sparkles" size={12} color="#fff" />
                </View>
                <View style={[styles.bubble, styles.bubbleBot]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              </View>
            ) : null
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {messages.length <= 1 && (
          <View style={styles.suggestionsWrap}>
            <Text style={styles.suggestLabel}>Try asking:</Text>
            <View style={styles.suggestRow}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  testID={`suggest-${s.slice(0, 10)}`}
                  style={styles.suggestChip}
                  onPress={() => send(s)}
                >
                  <Text style={styles.suggestText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.inputBar, { paddingBottom: Math.max(spacing.sm, insets.bottom) }]}>
          <TextInput
            testID="assistant-input"
            style={styles.input}
            placeholder="Ask Ghar Assistant..."
            placeholderTextColor={colors.textLight}
            value={text}
            onChangeText={setText}
            multiline
            editable={!sending}
          />
          <TouchableOpacity
            testID="assistant-send-btn"
            style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
            onPress={() => send()}
            disabled={!text.trim() || sending}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  botAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    ...shadow.card,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  headerSub: { fontSize: 11, color: colors.primary, fontWeight: "600" },
  messagesList: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.lg },
  bubbleRow: { flexDirection: "row", gap: 6, marginBottom: 6, alignItems: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  miniBot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "82%", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  msgText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  suggestionsWrap: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  suggestLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 6, fontWeight: "600" },
  suggestRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  suggestChip: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  suggestText: { fontSize: 12, color: colors.primary, fontWeight: "600" },
  inputBar: {
    flexDirection: "row",
    padding: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
    backgroundColor: colors.background,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
