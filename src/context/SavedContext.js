import { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_KEY = '@plated:saved';
const IMPORTED_KEY = '@plated:imported';
const FOLDERS_KEY = '@plated:folders';
const DEFAULT_FOLDER_ID = 'default';

const SavedContext = createContext(null);

export function SavedProvider({ children }) {
  const [saved, setSaved] = useState({});
  const [imported, setImported] = useState({});
  const [folders, setFolders] = useState({});
  const hydrated = useRef(false);

  useEffect(() => {
    (async () => {
      const [savedRaw, importedRaw, foldersRaw] = await Promise.all([
        AsyncStorage.getItem(SAVED_KEY),
        AsyncStorage.getItem(IMPORTED_KEY),
        AsyncStorage.getItem(FOLDERS_KEY),
      ]);
      if (savedRaw) setSaved(JSON.parse(savedRaw));
      if (importedRaw) setImported(JSON.parse(importedRaw));
      if (foldersRaw) setFolders(JSON.parse(foldersRaw));
      hydrated.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  }, [saved]);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(IMPORTED_KEY, JSON.stringify(imported));
  }, [imported]);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  }, [folders]);

  // A recipe is "saved" once it's filed into any folder — the plain bookmark
  // icon (Feed/Search/Detail) files into the default "Saved" folder; the
  // Detail screen's "Save to a folder" button can file it anywhere.
  function isSaved(id) {
    return Object.values(folders).some((folder) => folder.recipeIds.includes(id));
  }

  function addToFolder(folderId, recipe) {
    setSaved((prev) => (prev[recipe.id] ? prev : { ...prev, [recipe.id]: { id: recipe.id, title: recipe.title, thumb: recipe.thumb } }));
    setFolders((prev) => {
      const folder = prev[folderId] || { id: folderId, name: folderId === DEFAULT_FOLDER_ID ? 'Saved' : folderId, recipeIds: [] };
      if (folder.recipeIds.includes(recipe.id)) return prev;
      return { ...prev, [folderId]: { ...folder, recipeIds: [...folder.recipeIds, recipe.id] } };
    });
  }

  function toggleSave(recipe) {
    if (isSaved(recipe.id)) {
      setFolders((prev) => {
        const next = {};
        for (const [fid, folder] of Object.entries(prev)) {
          next[fid] = { ...folder, recipeIds: folder.recipeIds.filter((id) => id !== recipe.id) };
        }
        return next;
      });
    } else {
      addToFolder(DEFAULT_FOLDER_ID, recipe);
    }
  }

  function createFolder(name) {
    const id = `folder-${Date.now()}`;
    setFolders((prev) => ({ ...prev, [id]: { id, name, recipeIds: [] } }));
    return id;
  }

  function addImported(recipe) {
    setImported((prev) => ({ ...prev, [recipe.id]: recipe }));
  }

  // Resolves a folder's recipeId back into displayable data — imported
  // recipes carry full detail, plain saves are feed/search stubs.
  function getRecipeStub(id) {
    if (imported[id]) return { ...imported[id], _imported: true };
    if (saved[id]) return { ...saved[id], _imported: false };
    return null;
  }

  const value = {
    saved: Object.values(saved),
    imported: Object.values(imported),
    folders: Object.values(folders),
    isSaved,
    toggleSave,
    addImported,
    addToFolder,
    createFolder,
    getRecipeStub,
    DEFAULT_FOLDER_ID,
  };

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used within a SavedProvider');
  return ctx;
}
