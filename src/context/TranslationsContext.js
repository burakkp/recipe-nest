import { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRANSLATIONS_KEY = '@plated:translations';

const TranslationsContext = createContext(null);

export function TranslationsProvider({ children }) {
  const [translations, setTranslations] = useState({});
  const hydrated = useRef(false);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(TRANSLATIONS_KEY);
      if (raw) setTranslations(JSON.parse(raw));
      hydrated.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    AsyncStorage.setItem(TRANSLATIONS_KEY, JSON.stringify(translations));
  }, [translations]);

  function getCachedTranslation(recipeId, langCode) {
    return translations[recipeId]?.[langCode] || null;
  }

  function setCachedTranslation(recipeId, langCode, data) {
    setTranslations((prev) => ({
      ...prev,
      [recipeId]: { ...prev[recipeId], [langCode]: data },
    }));
  }

  const value = { getCachedTranslation, setCachedTranslation };

  return <TranslationsContext.Provider value={value}>{children}</TranslationsContext.Provider>;
}

export function useTranslations() {
  const ctx = useContext(TranslationsContext);
  if (!ctx) throw new Error('useTranslations must be used within a TranslationsProvider');
  return ctx;
}
