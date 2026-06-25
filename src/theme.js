// Design tokens — mirrors docs/design_handoff_recipenest/README.md.
export const colors = {
  bg: '#FBF8F4', // app background (import / empty screens)
  screen: '#FFFFFF', // card & screen surfaces
  ink: '#1A1714', // primary text, active icons, step bullets
  muted: '#8A817A', // secondary text, inactive tab icons
  accent: '#FF4D2E', // likes, saves, primary CTAs
  herb: '#2E7D4F', // cook-time + tags
  line: '#EFE9E1', // hairline borders / dividers
  chip: '#F4EFE8', // chip & search-field background
  chipText: '#5C544C',
  herbBg: '#EAF3ED',
  accentBg: '#FFE9E4',
  accentSoft: '#FFF6F4',
  inactive: '#B6AEA4',
  divider: '#F4EFE8',
};

export const radius = { sm: 8, md: 12, lg: 20, xl: 24, pill: 999 };

export const spacing = { screenX: 22, gap: 16 };

// Plus Jakarta Sans isn't bundled yet (no expo-font dependency added). Do not
// set fontFamily to an unregistered name here — on Android that breaks text
// metrics (clipped/misaligned glyphs) instead of cleanly falling back like iOS.
export const type = {
  display: { fontSize: 27, fontWeight: '800', letterSpacing: -0.5, lineHeight: 32 },
  title: { fontSize: 19, fontWeight: '700', lineHeight: 24 },
  cardTitle: { fontSize: 21, fontWeight: '800', letterSpacing: -0.2, lineHeight: 26 },
  body: { fontSize: 15, fontWeight: '500', lineHeight: 22 },
  // No lineHeight here on purpose: these back small single-line pills/chips,
  // and a guessed-too-tight value clips Android's system-font glyphs. Letting
  // the platform size the line naturally is the safe default without a real
  // custom font loaded to calibrate against.
  meta: { fontSize: 12, fontWeight: '600' },
  caption: { fontSize: 11, fontWeight: '600', letterSpacing: 1.3 },
};

// iOS shadow values; Android uses `elevation`.
export const shadow = {
  card: { shadowColor: '#281E14', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  cta: { shadowColor: '#FF4D2E', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  float: { shadowColor: '#281E14', shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
};

export default { colors, radius, spacing, type, shadow };
