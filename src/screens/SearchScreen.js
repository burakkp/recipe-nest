import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchRecipes } from '../api/mealdb';
import { useSaved } from '../context/SavedContext';
import { colors, radius, spacing, type } from '../theme';

const DEBOUNCE_MS = 350;

function SearchTile({ recipe, onPress, isSaved, onToggleSave }) {
  return (
    <Pressable style={styles.tile} onPress={onPress}>
      <View style={styles.tileImageWrap}>
        <Image source={{ uri: recipe.thumb }} style={styles.tileImage} resizeMode="cover" />
        <Pressable style={styles.tileBookmark} onPress={onToggleSave} hitSlop={8}>
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={16}
            color={colors.ink}
          />
        </Pressable>
      </View>
      <Text style={styles.tileTitle} numberOfLines={2}>
        {recipe.title}
      </Text>
      {!!recipe.category && <Text style={styles.tileMeta}>{recipe.category}</Text>}
    </Pressable>
  );
}

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef(null);
  const { isSaved, toggleSave } = useSaved();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const term = query.trim();
    if (!term) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchRecipes(term);
        setResults(data);
      } catch (e) {
        setResults([]);
      } finally {
        setSearched(true);
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function openRecipe(recipe) {
    navigation.navigate('Detail', { recipe });
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search recipes"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {!query.trim() ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Search for a recipe by name.</Text>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Searching…</Text>
        </View>
      ) : searched && results.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.muted}>No recipes found for "{query.trim()}".</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.resultsHeader}>{results.length} RESULTS</Text>
          }
          renderItem={({ item }) => (
            <SearchTile
              recipe={item}
              onPress={() => openRecipe(item)}
              isSaved={isSaved(item.id)}
              onToggleSave={() => toggleSave(item)}
            />
          )}
        />
      )}
    </View>
  );
}

const TILE_WIDTH = '48%';

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  header: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: 16,
  },
  headerTitle: {
    ...type.display,
    fontSize: 26,
    color: colors.ink,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  list: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: 24,
  },
  row: {
    gap: 16,
  },
  resultsHeader: {
    ...type.caption,
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  tile: {
    width: TILE_WIDTH,
    marginBottom: 20,
  },
  tileImageWrap: {
    position: 'relative',
  },
  tileImage: {
    width: '100%',
    height: 150,
    borderRadius: radius.lg,
    backgroundColor: colors.chip,
  },
  tileBookmark: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 14 * 1.25,
    marginTop: 9,
  },
  tileMeta: {
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
    paddingHorizontal: 24,
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
  },
});
