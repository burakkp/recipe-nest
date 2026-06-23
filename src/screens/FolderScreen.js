import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSaved } from '../context/SavedContext';
import { colors, radius, spacing, type } from '../theme';

export default function FolderScreen({ route, navigation }) {
  const { folderId } = route.params || {};
  const { folders, getRecipeStub } = useSaved();
  const folder = folders.find((f) => f.id === folderId);
  const insets = useSafeAreaInsets();

  const recipes = (folder?.recipeIds || []).map(getRecipeStub).filter(Boolean);

  function openRecipe(recipe) {
    if (recipe._imported) {
      navigation.navigate('Detail', { recipe });
    } else {
      navigation.navigate('Detail', { id: recipe.id, title: recipe.title });
    }
  }

  if (!folder) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Folder not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </Pressable>
        <Pressable style={styles.iconButton} hitSlop={8}>
          <Ionicons name="options-outline" size={20} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.folderName}>{folder.name}</Text>
        <Text style={styles.folderCount}>{recipes.length} recipes</Text>
      </View>

      <FlatList
        data={recipes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => openRecipe(item)}>
            <Image source={{ uri: item.thumb }} style={styles.thumb} resizeMode="cover" />
            <View style={styles.rowBody}>
              {item._imported && (
                <View style={styles.badge}>
                  <Ionicons name="sparkles-outline" size={11} color={colors.accent} />
                  <Text style={styles.badgeText}>IMPORTED</Text>
                </View>
              )}
              <Text style={styles.rowTitle} numberOfLines={2}>
                {item.title}
              </Text>
              {!!item.category && <Text style={styles.rowMeta}>{item.category}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.muted}>No recipes in this folder yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenX,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 16,
    paddingBottom: 8,
  },
  folderName: {
    ...type.display,
    color: colors.ink,
  },
  folderCount: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  list: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 8,
    paddingBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.chip,
  },
  rowBody: {
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.accentBg,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 5,
    marginBottom: 6,
  },
  badgeText: {
    color: colors.accent,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  rowMeta: {
    color: colors.herb,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
  },
});
