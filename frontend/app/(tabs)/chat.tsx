import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius } from "@/src/theme";

export default function ChatListScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const t = await api.listThreads();
      setThreads(t);
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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title} testID="chats-title">Chats</Text>
      </View>

      {!user ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textLight} />
          <Text style={styles.emptyTitle}>Sign in to view chats</Text>
          <TouchableOpacity onPress={() => router.push("/auth/phone")}>
            <Text style={styles.link}>Log In</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : threads.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textLight} />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyMsg}>Contact a property owner to start chatting</Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.thread_id}
          contentContainerStyle={{ padding: spacing.lg }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`chat-thread-${item.thread_id}`}
              style={styles.row}
              onPress={() =>
                router.push({
                  pathname: "/chat/[thread]",
                  params: {
                    thread: item.thread_id,
                    property_id: item.property?.id,
                    other_user_id: item.other_user?.id,
                    other_name: item.other_user?.name,
                    property_title: item.property?.title,
                  },
                })
              }
            >
              {item.property?.images?.[0] ? (
                <Image source={{ uri: item.property.images[0] }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="home" size={22} color={colors.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.other_user?.name || "User"}
                </Text>
                <Text style={styles.property} numberOfLines={1}>
                  {item.property?.title}
                </Text>
                <Text style={styles.msg} numberOfLines={1}>
                  {item.last_message?.text}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: spacing.xl },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginTop: spacing.sm },
  emptyMsg: { fontSize: 14, color: colors.textMuted },
  link: { color: colors.primary, fontWeight: "700", marginTop: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 12 },
  thumb: { width: 52, height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 15, fontWeight: "700", color: colors.text },
  property: { fontSize: 12, color: colors.primary, marginTop: 2 },
  msg: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
