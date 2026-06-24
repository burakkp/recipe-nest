import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SUPPORTED_LANGUAGES, getLanguageLabel } from '../constants/languages';
import { colors, radius } from '../theme';

export default function LanguagePicker({ value, loading, onChange }) {
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();

  function pick(code) {
    setVisible(false);
    if (code !== value) onChange(code);
  }

  return (
    <>
      <Pressable style={styles.button} onPress={() => setVisible(true)} disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.ink} />
        ) : (
          <Ionicons name="language-outline" size={16} color={colors.ink} />
        )}
        <Text style={styles.buttonText}>{getLanguageLabel(value)}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.muted} />
      </Pressable>

      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Show recipe in</Text>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <Pressable key={lang.code} style={styles.row} onPress={() => pick(lang.code)}>
                <Text style={styles.rowText}>{lang.label}</Text>
                {lang.code === value && <Ionicons name="checkmark" size={18} color={colors.accent} />}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.chip,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  buttonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26,23,20,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.screen,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
  },
});
