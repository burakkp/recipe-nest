import { useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSaved } from '../context/SavedContext';
import { colors, radius, spacing, type } from '../theme';

function NewFolderModal({ visible, onClose, onCreate }) {
  const [name, setName] = useState('');
  const insets = useSafeAreaInsets();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setName('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
          <Text style={styles.sheetTitle}>New folder</Text>
          <TextInput
            style={styles.sheetInput}
            placeholder="Folder name"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            autoFocus
          />
          <Pressable style={styles.sheetButton} onPress={submit}>
            <Text style={styles.sheetButtonText}>Create folder</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FolderCover({ thumbs }) {
  const slots = [0, 1, 2, 3];
  return (
    <View style={styles.cover}>
      {slots.map((i) => (
        <View key={i} style={styles.coverSlot}>
          {thumbs[i] ? (
            <Image source={{ uri: thumbs[i] }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <View style={[styles.coverImage, styles.coverPlaceholder]} />
          )}
        </View>
      ))}
    </View>
  );
}

export default function SavedScreen({ navigation }) {
  const { folders, createFolder, getRecipeStub } = useSaved();
  const [modalVisible, setModalVisible] = useState(false);
  const insets = useSafeAreaInsets();

  function openFolder(folder) {
    navigation.navigate('Folder', { folderId: folder.id });
  }

  if (folders.length === 0) {
    return (
      <View style={styles.screen}>
        <View style={styles.empty}>
          <Ionicons name="bookmark-outline" size={48} color={colors.muted} />
          <Text style={styles.muted}>Save a recipe to create your first folder.</Text>
        </View>
        <NewFolderModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          onCreate={createFolder}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.headerTitle}>Your folders</Text>
        <Pressable style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <FlatList
        data={folders}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          <Pressable style={[styles.card, styles.newFolderTile]} onPress={() => setModalVisible(true)}>
            <View style={styles.newFolderIcon}>
              <Ionicons name="add" size={22} color={colors.muted} />
            </View>
            <Text style={styles.newFolderLabel}>New folder</Text>
          </Pressable>
        }
        renderItem={({ item }) => {
          const thumbs = item.recipeIds
            .map((id) => getRecipeStub(id)?.thumb)
            .filter(Boolean)
            .slice(0, 4);
          return (
            <Pressable style={styles.card} onPress={() => openFolder(item)}>
              <FolderCover thumbs={thumbs} />
              <Text style={styles.folderName}>{item.name}</Text>
              <Text style={styles.folderCount}>{item.recipeIds.length} recipes</Text>
            </Pressable>
          );
        }}
      />

      <NewFolderModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onCreate={createFolder}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenX,
    paddingBottom: 16,
  },
  headerTitle: {
    ...type.display,
    fontSize: 26,
    color: colors.ink,
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.screenX,
    paddingBottom: 24,
  },
  row: {
    gap: 16,
  },
  card: {
    width: TILE_WIDTH,
    marginBottom: 20,
  },
  cover: {
    width: '100%',
    height: 152,
    borderRadius: radius.xl,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    backgroundColor: colors.chip,
  },
  coverSlot: {
    width: '49%',
    height: '49%',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    backgroundColor: colors.chip,
  },
  folderName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  folderCount: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  newFolderTile: {
    height: 152 + 36,
    borderWidth: 1.5,
    borderColor: '#D9CFC2',
    borderStyle: 'dashed',
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  newFolderIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newFolderLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
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
  sheetInput: {
    backgroundColor: colors.chip,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 15,
    marginBottom: 14,
  },
  sheetButton: {
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetButtonText: {
    color: colors.screen,
    fontWeight: '700',
    fontSize: 15,
  },
});
