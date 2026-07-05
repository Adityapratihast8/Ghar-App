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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius } from "@/src/theme";

export default function ChatThreadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { property_id, other_user_id, other_name, property_title } = useLocalSearchParams<{
    property_id: string;
    other_user_id: string;
    other_name?: string;
    property_title?: string;
  }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList>(null);

  const load = async () => {
    try {
      const res = await api.getThread(String(property_id), String(other_user_id));
      setMessages(res.messages || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property_id, other_user_id]);

  const send = async () => {
    if (!text.trim()) return;
    const optimistic = {
      id: `temp-${Date.now()}`,
      text: text.trim(),
      from_user_id: user?.id,
      to_user_id: other_user_id,
      created_at: new Date().toISOString(),
    };
    setMessages((p) => [...p, optimistic]);
    setText("");
    try {
      await api.sendMessage(String(property_id), String(other_user_id), optimistic.text);
      load();
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="chat-back">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName} numberOfLines={1}>{other_name || "User"}</Text>
          {property_title ? (
            <Text style={styles.headerProperty} numberOfLines={1}>{property_title}</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => router.push(`/property/${property_id}`)}>
          <Ionicons name="information-circle" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={insets.top}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
            renderItem={({ item }) => {
              const mine = item.from_user_id === user?.id;
              return (
                <View style={[styles.bubbleRow, mine ? styles.rowRight : styles.rowLeft]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                    <Text style={[styles.msgText, mine && { color: "#fff" }]}>{item.text}</Text>
                    <Text style={[styles.time, mine && { color: "rgba(255,255,255,0.7)" }]}>
                      {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                </View>
              );
            }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={<Text style={styles.empty}>Say hi to start the conversation</Text>}
          />
        )}
        <View style={[styles.inputBar, { paddingBottom: Math.max(spacing.sm, insets.bottom) }]}>
          <TextInput
            testID="chat-input"
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.textLight}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity testID="chat-send-btn" style={styles.sendBtn} onPress={send} disabled={!text.trim()}>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerName: { fontSize: 16, fontWeight: "700", color: colors.text },
  headerProperty: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  bubbleRow: { flexDirection: "row" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  bubble: { maxWidth: "78%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  msgText: { fontSize: 14, color: colors.text },
  time: { fontSize: 10, color: colors.textMuted, marginTop: 3, alignSelf: "flex-end" },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl },
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
