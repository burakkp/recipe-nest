import { useEffect, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchRecipeById } from '../api/mealdb';
import { useSaved } from '../context/SavedContext';
import { colors, radius, shadow, spacing, type } from '../theme';

function FolderPicker({ visible, recipe, onClose }) {
  const { folders, createFolder, addToFolder } = useSaved();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const insets = useSafeAreaInsets();

  function pick(folderId) {
    addToFolder(folderId, recipe);
    onClose();
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = createFolder(trimmed);
    addToFolder(id, recipe);
    setName('');
    setCreating(false);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
          <Text style={styles.sheetTitle}>Save to a folder</Text>
          {folders.map((folder) => (
            <Pressable key={folder.id} style={styles.sheetRow} onPress={() => pick(folder.id)}>
              <Ionicons name="folder-outline" size={20} color={colors.ink} />
              <Text style={styles.sheetRowText}>{folder.name}</Text>
            </Pressable>
          ))}

          {creating ? (
            <View style={styles.newFolderRow}>
              <TextInput
                style={styles.newFolderInput}
                placeholder="Folder name"
                placeholderTextColor={colors.muted}
                value={name}
                onChangeText={setName}
                autoFocus
              />
              <Pressable style={styles.newFolderButton} onPress={handleCreate}>
                <Text style={styles.newFolderButtonText}>Create</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.sheetRow} onPress={() => setCreating(true)}>
              <Ionicons name="add" size={20} color={colors.accent} />
              <Text style={[styles.sheetRowText, { color: colors.accent }]}>New folder</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function DetailScreen({ route, navigation }) {
  const { recipe: passedRecipe, id } = route.params || {};
  const [recipe, setRecipe] = useState(passedRecipe || null);
  const [loading, setLoading] = useState(!passedRecipe);
  const [error, setError] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const { isSaved, toggleSave } = useSaved();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (passedRecipe) return;
    let active = true;
    setLoading(true);
    fetchRecipeById(id)
      .then((data) => {
        if (active) setRecipe(data);
      })
      .catch(() => {
        if (active) setError('Could not load this recipe.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, passedRecipe]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading recipe…</Text>
      </View>
    );
  }

  if (error || !recipe) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{error || 'Recipe not found.'}</Text>
      </View>
    );
  }

  const saved = isSaved(recipe.id);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: recipe.thumb }} style={styles.hero} />
          <View style={[styles.heroOverlayRow, { top: insets.top + 16 }]}>
            <Pressable style={styles.circleButton} onPress={() => navigation.goBack()} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={colors.ink} />
            </Pressable>
            <Pressable style={styles.circleButton} onPress={() => toggleSave(recipe)} hitSlop={8}>
              <Ionicons
                name={saved ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={colors.ink}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{recipe.title}</Text>
          {!!recipe.handle && <Text style={styles.handle}>@{recipe.handle}</Text>}
          {!!recipe.description && <Text style={styles.description}>{recipe.description}</Text>}

          {(recipe.category || recipe.area) && (
            <View style={styles.tagsRow}>
              {recipe.area && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{recipe.area}</Text>
                </View>
              )}
              {recipe.category && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{recipe.category}</Text>
                </View>
              )}
            </View>
          )}

          <Text style={styles.sectionHeading}>Ingredients</Text>
          {(recipe.ingredients || []).map((ing, idx) => (
            <View
              key={`${ing.name}-${idx}`}
              style={[
                styles.ingredientRow,
                idx === recipe.ingredients.length - 1 && styles.noBorder,
              ]}
            >
              <Text style={styles.ingredientName}>{ing.name}</Text>
              <Text style={styles.ingredientMeasure}>{ing.measure}</Text>
            </View>
          ))}

          <Text style={styles.sectionHeading}>Method</Text>
          {(recipe.steps || []).map((step, idx) => (
            <View key={idx} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{idx + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}

          {recipe.source ? (
            <Pressable onPress={() => Linking.openURL(recipe.source)}>
              <Text style={styles.sourceLink}>
                {recipe.handle ? `View @${recipe.handle}'s post` : 'View original post'}
              </Text>
            </Pressable>
          ) : null}
          {recipe.video ? (
            <Pressable onPress={() => Linking.openURL(recipe.video)}>
              <Text style={styles.sourceLink}>Watch original video</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable style={styles.bookmarkButton} onPress={() => toggleSave(recipe)}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={colors.ink}
          />
        </Pressable>
        <Pressable style={styles.saveToFolderButton} onPress={() => setPickerVisible(true)}>
          <Text style={styles.saveToFolderText}>Save to a folder</Text>
        </Pressable>
      </View>

      <FolderPicker
        visible={pickerVisible}
        recipe={recipe}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  content: {
    paddingBottom: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.screen,
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
  },
  heroWrap: {
    position: 'relative',
  },
  hero: {
    width: '100%',
    height: 430,
    backgroundColor: colors.chip,
  },
  heroOverlayRow: {
    position: 'absolute',
    left: spacing.screenX,
    right: spacing.screenX,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: spacing.screenX,
    paddingTop: 24,
  },
  title: {
    ...type.display,
    color: colors.ink,
    marginBottom: 12,
  },
  handle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  description: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  chip: {
    backgroundColor: colors.chip,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    ...type.meta,
    lineHeight: 17,
    color: colors.chipText,
  },
  sectionHeading: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  ingredientName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  ingredientMeasure: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '500',
  },
  stepRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 18,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: colors.screen,
    fontWeight: '700',
    fontSize: 13,
  },
  stepText: {
    flex: 1,
    color: '#3A342E',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 14 * 1.55,
  },
  sourceLink: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.screenX,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.screen,
  },
  bookmarkButton: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveToFolderButton: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.cta,
  },
  saveToFolderText: {
    color: colors.screen,
    fontSize: 16,
    fontWeight: '700',
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26,23,20,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.screen,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenX,
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sheetRowText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
  },
  newFolderRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
  },
  newFolderInput: {
    flex: 1,
    backgroundColor: colors.chip,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 14,
  },
  newFolderButton: {
    backgroundColor: colors.ink,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  newFolderButtonText: {
    color: colors.screen,
    fontWeight: '700',
    fontSize: 14,
  },
});
