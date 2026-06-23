import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { extractRecipe } from '../api/extract';
import { useSaved } from '../context/SavedContext';
import { colors, radius, spacing, type } from '../theme';

export default function ShareImportScreen({ route, navigation }) {
  const { url, text } = route.params || {};
  const { addImported, addToFolder, DEFAULT_FOLDER_ID } = useSaved();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState('loading'); // loading | ready | needs_caption | error
  const [draft, setDraft] = useState(null);
  const [captionInfo, setCaptionInfo] = useState(null); // { image, video, handle, sourceUrl }
  const [pastedText, setPastedText] = useState('');

  const runExtract = useCallback((payload) => {
    setStatus('loading');
    extractRecipe(payload)
      .then((data) => {
        setDraft({
          title: data.title || '',
          image: data.image || '',
          video: data.video || '',
          handle: data.handle || '',
          area: data.area || '',
          category: data.category || '',
          ingredients: data.ingredients || [],
          steps: data.steps || [],
          sourceUrl: data.sourceUrl || payload.url || '',
        });
        setStatus('ready');
      })
      .catch((err) => {
        if (err.code === 'NEEDS_CAPTION') {
          setCaptionInfo({
            image: err.image,
            video: err.video,
            handle: err.handle,
            sourceUrl: err.sourceUrl,
          });
          setStatus('needs_caption');
        } else {
          setStatus('error');
        }
      });
  }, []);

  useEffect(() => {
    runExtract({ url, text });
  }, [runExtract, url, text]);

  function updateTitle(value) {
    setDraft((prev) => ({ ...prev, title: value }));
  }

  function updateIngredient(index, field, value) {
    setDraft((prev) => {
      const ingredients = [...prev.ingredients];
      ingredients[index] = { ...ingredients[index], [field]: value };
      return { ...prev, ingredients };
    });
  }

  function updateStep(index, value) {
    setDraft((prev) => {
      const steps = [...prev.steps];
      steps[index] = value;
      return { ...prev, steps };
    });
  }

  function handleSave() {
    const recipe = {
      id: `imported-${Date.now()}`,
      title: draft.title,
      thumb: draft.image,
      video: draft.video,
      handle: draft.handle,
      area: draft.area,
      category: draft.category,
      ingredients: draft.ingredients,
      instructions: draft.steps.join('\n'),
      steps: draft.steps,
      source: draft.sourceUrl,
    };
    addImported(recipe);
    addToFolder(DEFAULT_FOLDER_ID, recipe);
    navigation.replace('Detail', { id: recipe.id, recipe });
  }

  function handleDiscard() {
    navigation.goBack();
  }

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.ink} />
        <Text style={styles.muted}>Extracting recipe…</Text>
      </View>
    );
  }

  if (status === 'needs_caption') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {captionInfo?.image ? (
          <Image source={{ uri: captionInfo.image }} style={styles.previewImage} />
        ) : null}
        <Text style={styles.heading}>We couldn't read a recipe from that link</Text>
        <Text style={styles.muted}>
          Paste the caption or recipe text below and we'll structure it for you.
        </Text>
        {!!captionInfo?.sourceUrl && (
          <TouchableOpacity onPress={() => Linking.openURL(captionInfo.sourceUrl)}>
            <Text style={styles.sourceLink}>
              {captionInfo.handle ? `View @${captionInfo.handle}'s post` : 'View original post'}
            </Text>
          </TouchableOpacity>
        )}
        <TextInput
          style={styles.captionInput}
          multiline
          placeholder="Paste the caption here…"
          placeholderTextColor={colors.muted}
          value={pastedText}
          onChangeText={setPastedText}
        />
        <TouchableOpacity
          style={[styles.primaryButton, !pastedText.trim() && styles.buttonDisabled]}
          disabled={!pastedText.trim()}
          onPress={() => runExtract({ url, text: pastedText })}
        >
          <Text style={styles.primaryButtonText}>Extract recipe</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleDiscard}>
          <Text style={styles.secondaryButtonText}>Discard</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>Something went wrong</Text>
        <Text style={styles.muted}>Could not reach the extraction service.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => runExtract({ url, text })}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleDiscard}>
          <Text style={styles.secondaryButtonText}>Discard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.readyContent, { paddingBottom: insets.bottom + 40 }]}>
      <View style={styles.formBody}>
        <View style={styles.foundPill}>
          <Ionicons name="checkmark-circle" size={14} color={colors.herb} />
          <Text style={styles.foundPillText}>Recipe found</Text>
        </View>
      </View>

      {/* Direction A · Social card preview of the imported post */}
      <View style={styles.card}>
        <View style={styles.authorRow}>
          <View style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.author}>plated.kitchen</Text>
            <Text style={styles.authorSub}>{draft.area || 'Imported recipe'}</Text>
          </View>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.ink} />
        </View>

        {draft.image ? (
          <Image source={{ uri: draft.image }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]} />
        )}

        <View style={styles.actions}>
          <Ionicons name="heart-outline" size={26} color={colors.ink} />
          <Ionicons name="chatbubble-outline" size={25} color={colors.ink} style={styles.commentIcon} />
          <View style={{ flex: 1 }} />
          <Ionicons name="bookmark" size={25} color={colors.ink} />
        </View>

        <View style={styles.titleBlock}>
          {!!draft.sourceUrl && (
            <TouchableOpacity onPress={() => Linking.openURL(draft.sourceUrl)}>
              <Text style={styles.sourceLink}>
                {draft.handle ? `View @${draft.handle}'s post` : 'View original post'}
              </Text>
            </TouchableOpacity>
          )}
          {!!draft.video && (
            <TouchableOpacity onPress={() => Linking.openURL(draft.video)}>
              <Text style={styles.sourceLink}>Watch original video</Text>
            </TouchableOpacity>
          )}
          <View style={styles.titleInputRow}>
            <TextInput
              style={styles.titleInput}
              value={draft.title}
              onChangeText={updateTitle}
              placeholder="Recipe title"
              placeholderTextColor={colors.muted}
            />
            <Ionicons name="pencil-outline" size={16} color={colors.muted} />
          </View>
          {(!!draft.area || !!draft.category) && (
            <View style={styles.chipRow}>
              {!!draft.area && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{draft.area}</Text>
                </View>
              )}
              {!!draft.category && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{draft.category}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      <View style={styles.formBody}>
        <Text style={styles.sectionHeading}>Ingredients · {draft.ingredients.length}</Text>
        {draft.ingredients.map((ing, idx) => (
          <View key={idx} style={styles.ingredientRow}>
            <TextInput
              style={[styles.input, styles.ingredientName]}
              value={ing.name}
              onChangeText={(value) => updateIngredient(idx, 'name', value)}
              placeholder="Ingredient"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={[styles.input, styles.ingredientMeasure]}
              value={ing.measure}
              onChangeText={(value) => updateIngredient(idx, 'measure', value)}
              placeholder="Measure"
              placeholderTextColor={colors.muted}
            />
          </View>
        ))}

        <Text style={styles.sectionHeading}>Steps · {draft.steps.length}</Text>
        {draft.steps.map((step, idx) => (
          <View key={idx} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{idx + 1}</Text>
            <TextInput
              style={[styles.input, styles.stepInput]}
              value={step}
              onChangeText={(value) => updateStep(idx, value)}
              multiline
            />
          </View>
        ))}

        <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
          <Text style={styles.primaryButtonText}>Save to my recipes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleDiscard}>
          <Text style={styles.secondaryButtonText}>Discard</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  content: {
    padding: 16,
  },
  readyContent: {
    paddingTop: 16,
  },
  formBody: {
    paddingHorizontal: spacing.screenX,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.screen,
    gap: 12,
    padding: 24,
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
  },
  heading: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.chip,
    marginBottom: 16,
  },
  sourceLink: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },

  // Direction A · Social card preview
  foundPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.herbBg,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  foundPillText: {
    ...type.meta,
    color: colors.herb,
  },
  card: {
    backgroundColor: colors.screen,
    marginBottom: 24,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.screenX,
    paddingBottom: 12,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.chip,
  },
  author: { ...type.meta, fontSize: 14, fontWeight: '700', color: colors.ink },
  authorSub: { fontSize: 12, fontWeight: '500', color: colors.muted, marginTop: 1 },
  photo: { width: '100%', aspectRatio: 1, backgroundColor: colors.chip },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: spacing.screenX,
    paddingTop: 14,
    paddingBottom: 8,
  },
  commentIcon: {
    marginLeft: 0,
  },
  titleBlock: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 6,
  },
  titleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  titleInput: {
    ...type.cardTitle,
    flex: 1,
    color: colors.ink,
    padding: 0,
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    backgroundColor: colors.chip,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  chipText: { ...type.meta, color: colors.chipText },

  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  sectionHeading: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.chip,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.ink,
    fontSize: 14,
  },
  ingredientRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  ingredientName: {
    flex: 2,
  },
  ingredientMeasure: {
    flex: 1,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  stepNumber: {
    color: colors.herb,
    fontWeight: '700',
    width: 20,
    fontSize: 14,
    paddingTop: 10,
  },
  stepInput: {
    flex: 1,
    minHeight: 40,
  },
  captionInput: {
    backgroundColor: colors.chip,
    borderRadius: radius.md,
    padding: 12,
    minHeight: 140,
    color: colors.ink,
    fontSize: 14,
    textAlignVertical: 'top',
    marginVertical: 16,
  },
  primaryButton: {
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: colors.screen,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '600',
  },
});
