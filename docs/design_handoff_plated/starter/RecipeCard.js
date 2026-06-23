// src/components/RecipeCard.js
// Plated feed card — "Direction A · Social" from the design reference.
//
// Renders an Instagram-style card: author row, edge-to-edge 1:1 photo, action row
// (heart / comment / spacer / bookmark), title, and a meta chip row (cook time + category).
//
// Props:
//   recipe      { id, title, thumb, category, area?, cookTime? }  // feed shape from mealdb.js
//   onPress()   open the recipe (navigate to Detail)
//   isSaved     boolean — controls the bookmark fill
//   onToggleSave() persist save/unsave (SavedContext.toggleSave)

import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type } from '../theme';

export default function RecipeCard({ recipe, onPress, isSaved = false, onToggleSave }) {
  // Like is visual-only for now (out of scope per brief); kept local.
  const [liked, setLiked] = useState(false);

  return (
    <View style={styles.card}>
      {/* Author row */}
      <View style={styles.authorRow}>
        <View style={styles.avatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.author}>{recipe.author || 'plated.kitchen'}</Text>
          <Text style={styles.authorSub}>{recipe.area || 'Recipe'}</Text>
        </View>
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.ink} />
      </View>

      {/* 1:1 hero photo — edge to edge */}
      <Pressable onPress={onPress}>
        <Image source={{ uri: recipe.thumb }} style={styles.photo} resizeMode="cover" />
      </Pressable>

      {/* Action row */}
      <View style={styles.actions}>
        <Pressable hitSlop={8} onPress={() => setLiked((v) => !v)}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={26}
            color={liked ? colors.accent : colors.ink}
          />
        </Pressable>
        <Pressable hitSlop={8} onPress={onPress}>
          <Ionicons name="chatbubble-outline" size={25} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={8} onPress={onToggleSave}>
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={25}
            color={colors.ink}
          />
        </Pressable>
      </View>

      {/* Title + meta chips */}
      <Pressable onPress={onPress} style={styles.meta}>
        <Text style={styles.title}>{recipe.title}</Text>
        <View style={styles.chipRow}>
          {!!recipe.cookTime && (
            <View style={[styles.chip, styles.herbChip]}>
              <Ionicons name="time-outline" size={13} color={colors.herb} />
              <Text style={styles.herbChipText}>{recipe.cookTime} min</Text>
            </View>
          )}
          {!!recipe.category && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{recipe.category}</Text>
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.screen,
    paddingBottom: 6,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.screenX,
    paddingTop: 4,
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

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: spacing.screenX,
    paddingTop: 14,
    paddingBottom: 8,
  },

  meta: { paddingHorizontal: spacing.screenX },
  title: { ...type.cardTitle, color: colors.ink, marginBottom: 9 },

  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.chip,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
  },
  chipText: { ...type.meta, color: colors.chipText },
  herbChip: { backgroundColor: colors.herbBg },
  herbChipText: { ...type.meta, color: colors.herb },
});
