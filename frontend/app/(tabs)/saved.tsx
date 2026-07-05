import { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing } from "@/src/theme";
import { PropertyCard, type PropertyItem } from "@/src/components/PropertyCard";

export default function SavedScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<PropertyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      const data = await api.getWishlist();
      setItems(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const toggleSave = async (id: string) => {
    await api.removeWishlist(id).catch(() => {});
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title} testID="saved-title">Saved Properties</Text>
        <Text style={styles.count}>{items.length} saved</Text>
      </View>

      {!user ? (
        <EmptyState
          icon="log-in"
          title="Sign in required"
          message="Please log in to save and view your favorite properties."
          actionLabel="Sign In"
          onAction={() => router.push("/auth/phone")}
        />
      ) : loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="heart"
          title="No saved properties"
          message="Tap the heart on any property to save it here."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          }
          renderItem={({ item }) => (
            <PropertyCard item={item} saved onToggleSave={toggleSave} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        />
      )}
    </SafeAreaView>
  );
}

function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: any;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={64} color={colors.textLight} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMsg}>{message}</Text>
      {actionLabel && onAction ? (
        <Text testID="empty-action" style={styles.emptyBtn} onPress={onAction}>
          {actionLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  count: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  list: { padding: spacing.lg },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.text, marginTop: spacing.md },
  emptyMsg: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
  emptyBtn: {
    marginTop: spacing.md,
    color: colors.primary,
    fontWeight: "700",
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
});
