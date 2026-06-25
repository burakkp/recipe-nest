import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, fetchByCategory } from '../api/mealdb';
import { useSaved } from '../context/SavedContext';
import RecipeCard from '../components/RecipeCard';
import LogoMark from '../components/Logo';
import { colors, spacing, type } from '../theme';

export default function FeedScreen({ navigation }) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const { isSaved, toggleSave } = useSaved();
  const insets = useSafeAreaInsets();

  const load = useCallback(async (cat) => {
    setError(false);
    try {
      const data = await fetchByCategory(cat);
      setRecipes(data);
    } catch (e) {
      setError(true);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load(category).finally(() => setLoading(false));
  }, [category, load]);

  async function onRefresh() {
    setRefreshing(true);
    await load(category);
    setRefreshing(false);
  }

  function openRecipe(recipe) {
    navigation.navigate('Detail', { id: recipe.id, title: recipe.title });
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.brand}>
          <View style={styles.logoMark}>
            <LogoMark size={16} color={colors.screen} />
          </View>
          <Text style={styles.wordmark}>RecipeNest</Text>
        </View>
        <Ionicons name="heart-outline" size={24} color={colors.ink} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {CATEGORIES.map((item) => {
          const active = item === category;
          return (
            <Pressable
              key={item}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setCategory(item)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading && recipes.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Something went wrong.</Text>
          <Pressable style={styles.retryButton} onPress={() => load(category)}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={{ ...item, category }}
              onPress={() => openRecipe(item)}
              isSaved={isSaved(item.id)}
              onToggleSave={() => toggleSave(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>No recipes in this category.</Text>
            </View>
          }
        />
      )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenX,
    paddingBottom: 14,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    ...type.display,
    fontSize: 22,
    color: colors.ink,
  },
  chipScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  chipRow: {
    flexGrow: 0,
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: spacing.screenX,
    paddingBottom: 16,
  },
  chip: {
    backgroundColor: colors.chip,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.ink,
  },
  chipText: {
    ...type.meta,
    fontSize: 13,
    lineHeight: 18,
    color: colors.chipText,
  },
  chipTextActive: {
    color: colors.screen,
  },
  separator: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
  },
  retryButton: {
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryText: {
    color: colors.screen,
    fontSize: 14,
    fontWeight: '700',
  },
});
