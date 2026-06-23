// src/theme.js
// Single source of truth for Plated's design tokens.
// Mirrors design_handoff_plated/README.md. Import these everywhere instead of hardcoding values.

export const colors = {
  bg:        '#FBF8F4', // app background (import / empty screens)
  screen:    '#FFFFFF', // card & screen surfaces
  ink:       '#1A1714', // primary text, active icons, step bullets
  muted:     '#8A817A', // secondary text, inactive tab icons
  accent:    '#FF4D2E', // likes, saves, primary CTAs
  herb:      '#2E7D4F', // cook-time + tags
  line:      '#EFE9E1', // hairline borders / dividers
  chip:      '#F4EFE8', // chip & search-field background
  // derived tints used in the mock
  chipText:  '#5C544C',
  herbBg:    '#EAF3ED',
  accentBg:  '#FFE9E4',
  accentSoft:'#FFF6F4',
  inactive:  '#B6AEA4',
  divider:   '#F4EFE8',
};

export const radius = { sm: 8, md: 12, lg: 20, xl: 24, pill: 999 };

export const spacing = { screenX: 22, gap: 16 };

// Font family key. Load with @expo-google-fonts/plus-jakarta-sans or expo-font.
// If you skip the custom font for v1, set family: undefined to fall back to system.
const family = 'PlusJakartaSans';
export const fonts = {
  r:  family,            // 400/500 via fontWeight
  family,
};

export const type = {
  display:   { fontFamily: family, fontSize: 27, fontWeight: '800', letterSpacing: -0.5, lineHeight: 30 },
  title:     { fontFamily: family, fontSize: 19, fontWeight: '700' },
  cardTitle: { fontFamily: family, fontSize: 21, fontWeight: '800', letterSpacing: -0.2 },
  body:      { fontFamily: family, fontSize: 15, fontWeight: '500', lineHeight: 22 },
  meta:      { fontFamily: family, fontSize: 12, fontWeight: '600' },
  caption:   { fontFamily: family, fontSize: 11, fontWeight: '600', letterSpacing: 1.3 }, // use textTransform: 'uppercase'
};

// iOS shadow values; Android uses `elevation`.
export const shadow = {
  card: {
    shadowColor: '#281E14', shadowOpacity: 0.06, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  cta: {
    shadowColor: '#FF4D2E', shadowOpacity: 0.30, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  float: {
    shadowColor: '#281E14', shadowOpacity: 0.14, shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
};

export default { colors, radius, spacing, fonts, type, shadow };
