# Handoff: RecipeNest — Recipe App UI

## Overview
RecipeNest is a warm, photo-first recipe app: an Instagram-style vertical feed, recipe detail,
search, saved recipes organized into **user-created folders**, and a headline **share-to-import**
flow that structures a shared post into a recipe with an LLM.

This package is the **visual layer** for the build described in your project brief
(`CLAUDE.md`): React Native + Expo (managed), React Navigation v6, JavaScript, TheMealDB +
a Cloudflare Worker. The brief defines the architecture; this README defines exactly how each
screen should **look** and how the design maps onto your target file structure.

## About the design files
`RecipeNest App Design.dc.html` is a **design reference created in HTML** — a static prototype
showing intended look, layout, and copy. It is **not** code to copy. Recreate these screens in
React Native using your existing patterns (StyleSheet, React Navigation, `@expo/vector-icons`).
Where the HTML uses inline CSS, translate to `StyleSheet.create`. Where it uses gradient
placeholders, use real `<Image>` components fed by TheMealDB `thumb` URLs.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, and component states are final. Match them
closely. The only deliberate placeholders are the food images (warm gradient blocks with a
monospace caption) — replace every one with a real photo from the API or the imported recipe.

---

## Design tokens → `src/theme.js`

```js
// src/theme.js — single source of truth for design values
export const colors = {
  bg:     '#FBF8F4',  // app background (import/empty screens)
  screen: '#FFFFFF',  // card & screen surfaces
  ink:    '#1A1714',  // primary text, active icons, step bullets
  muted:  '#8A817A',  // secondary text, inactive tab icons
  accent: '#FF4D2E',  // likes, saves, primary CTAs
  herb:   '#2E7D4F',  // cook-time + tags
  line:   '#EFE9E1',  // hairline borders / dividers
  chip:   '#F4EFE8',  // chip & search-field background
  // derived tints used in the mock:
  herbBg:   '#EAF3ED', // herb chip background
  accentBg: '#FFE9E4', // "Imported" badge background
  accentSoft:'#FFF6F4',// fallback notice background
  inactive: '#B6AEA4', // inactive tab label/icon
};

export const radius = { sm: 8, md: 12, lg: 20, xl: 24, pill: 999 };

export const spacing = { screenX: 22, gap: 16 }; // 22px horizontal screen padding

export const type = {
  family: 'PlusJakartaSans',   // load via expo-font (weights 400/500/600/700/800)
  display: { size: 27, weight: '800', letterSpacing: -0.5, lineHeight: 30 },
  title:   { size: 19, weight: '700' },
  cardTitle:{ size: 21, weight: '800', letterSpacing: -0.2 },
  body:    { size: 15, weight: '500', lineHeight: 22 },
  meta:    { size: 12, weight: '600' },           // chips / time
  caption: { size: 11, weight: '600', letterSpacing: 1.3 }, // UPPERCASE labels
};

export const shadow = {                            // iOS values; use elevation on Android
  card:   { shadowColor:'#281E14', shadowOpacity:0.06, shadowRadius:3, shadowOffset:{width:0,height:1} },
  cta:    { shadowColor:'#FF4D2E', shadowOpacity:0.30, shadowRadius:16, shadowOffset:{width:0,height:6} },
};
```

> **Font:** Plus Jakarta Sans (Google Fonts, OFL). Add via `@expo-google-fonts/plus-jakarta-sans`
> or bundle the .ttf files and load with `expo-font`. If you skip a custom font for v1, the
> system font is acceptable but loses the geometric character — note it as a follow-up.

### Icons
All icons are **thin line, ~1.6px stroke**. Use `@expo/vector-icons` Ionicons (already in the
brief). Mapping:

| UI element            | Ionicons name (outline / filled)        |
|-----------------------|------------------------------------------|
| Feed tab              | `home-outline` / `home`                  |
| Search tab + field    | `search-outline` / `search`              |
| Saved tab + save btn  | `bookmark-outline` / `bookmark`          |
| Like (heart)          | `heart-outline` / `heart` (filled = accent) |
| Comment               | `chatbubble-outline`                     |
| Back                  | `chevron-back`                           |
| Add / new folder      | `add`                                    |
| Cook time             | `time-outline`                           |
| Filter / reorder      | `options-outline` / `reorder-three-outline` |
| Edit                  | `pencil-outline`                         |
| Close (modal)         | `close`                                  |
| AI / import accent    | `sparkles-outline`                       |
| Link                  | `link-outline`                           |
| Row chevron           | `chevron-forward`                        |

---

## Logo / brand mark
RecipeNest's mark is a **woven nest with an egg** — a cozy, food-adjacent symbol. It sits in a
rounded-square tile of `accent` (#FF4D2E), drawn in white. Use it for the app icon, the feed
header, splash, and anywhere the brand appears.

- **Tile:** accent bg, `borderRadius` ≈ 0.3× tile size (14 on a 46pt tile, 9 on 28pt). Mark
  occupies ~58% of the tile.
- **Wordmark:** "RecipeNest" in Plus Jakarta Sans 800, `letterSpacing: -0.5`, `ink` color.
- **SVG source** (24×24 viewBox, white stroke, scales cleanly to an app icon):

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 11a9 6 0 0 0 18 0"/>          <!-- outer nest bowl -->
  <path d="M6.5 11.8a5.5 3.4 0 0 0 11 0"/>   <!-- inner weave -->
  <circle cx="12" cy="10.2" r="2.4" fill="#FFFFFF" stroke="none"/> <!-- egg -->
</svg>
```

In React Native render it with `react-native-svg` (`Svg`, `Path`, `Circle`), or export a 1024px
PNG of the tile+mark for `app.json` `icon`/`splash`. For the in-app feed header, the white mark
on the accent tile + the wordmark in `ink` is the lockup.

---

## Screens / Views

Phone canvas in the mock is 390pt wide. Horizontal screen padding is **22pt** everywhere unless
noted. Bottom tab bar is 86pt tall (incl. safe area), 1px top border in `line`.

### 1. Feed → `screens/FeedScreen.js` + `components/RecipeCard.js`
- **Header (not scrolled):** RecipeNest wordmark left — a 28pt accent rounded square (radius 9) with
  the **nest mark** + "RecipeNest" at 22pt/800. A `heart-outline` icon top-right.
- **Category chips:** horizontal `ScrollView`, 8pt gap. Active chip = `ink` bg, white text;
  inactive = `chip` bg, `#5c544c` text. Padding 9×17, fully rounded. From `CATEGORIES`.
- **RecipeCard** (the feed unit):
  - Author row: 34pt circle avatar (gradient placeholder ok — TheMealDB has no author), name
    14pt/700 `ink`, sub-line 12pt/500 `muted`, `ellipsis` (3 dots) right.
  - **1:1 image**, full card width, edge-to-edge. Real `<Image>` with the recipe `thumb`.
  - Action row: heart (filled `accent` when liked), comment, spacer (`flex:1`), bookmark
    (filled `ink` when saved). 26pt icons, 18pt gap, 14×22 padding.
  - Title 21pt/800, then a chip row: herb cook-time chip (`herbBg`/`herb`, `time` icon + "45 min")
    + a `chip`/`#5c544c` category chip.
- States: pull-to-refresh, centered loading spinner (accent), error retry. Tapping image/title →
  `navigation.navigate('Detail', { id, title })`.

### 2. Recipe Detail → `screens/DetailScreen.js`
- **Hero image** 430pt tall, full-bleed at top. White status bar text overlaid; back + bookmark
  as 40pt translucent-white circles (`rgba(255,255,255,.9)`, blur) over the image.
- **Body** (`screen` bg, 24pt padding): title 27pt/800 (two lines ok), meta chip row (herb
  cook-time + area + category).
- **Ingredients:** section title 17pt/700, then rows — name left (14pt/600 `ink`), measure
  right (14pt/500 `muted`), each row 11pt vertical padding + 1px `#F4EFE8` divider (no divider on
  last). Maps to normalized `ingredients:[{name,measure}]`.
- **Method:** "Method" 17pt/700, numbered steps. Each step = a 26pt `ink` circle with white
  number + step text 14pt/500, line-height 1.55, 18pt between steps. Maps to `steps:[]`.
- **Bottom bar (pinned):** 1px top border. A 52pt outlined bookmark button + a flex `accent`
  "Save to a folder" button (radius 14, `shadow.cta`) → opens the folder picker (see Saved).
- Accepts `route.params.recipe` (render directly) **or** `route.params.id` (fetch via `lookup`).

### 3. Search → `screens/SearchScreen.js`
- Title "Search" 26pt/800. **Search field:** `chip` bg, radius 14, 13×16 padding, `search-outline`
  + text + clear (`close`) right. Debounce ~350ms → `searchRecipes`.
- Results header: "{n} results" 13pt/600 `muted` UPPERCASE.
- **2-column grid**, 16pt gap. Each tile: 150pt image (radius 16) with a 30pt translucent-white
  bookmark button top-right; title 14pt/700 below; cook time 12pt/600 in `herb`.
- States: empty (prompt), loading, no-results. Reuse a compact card.

### 4. Saved / Folders → `screens/SavedScreen.js`
This is where the brief's "saved + imported" becomes **user folders** (the feature you confirmed).
- Title "Your folders" 26pt/800 + an `add` button (38pt `chip` square) to create a folder.
- **2-column grid of folder cards.** Each card: a 152pt cover that is a **2×2 collage** of the
  first four recipe thumbnails (radius 18, 2px gaps), then folder name 15pt/700 and
  "{n} recipes" 13pt/500 `muted`.
- A dashed **"New folder"** tile (1.5px dashed `#D9CFC2`, centered `add` in a `chip` circle).
- Empty state: bookmark icon + prompt to save a first recipe.

### 5. Folder Detail → (new) `screens/FolderScreen.js`
- Back button (40pt `chip` circle) + reorder/filter icon. Folder name 27pt/800, "{n} recipes".
- **Recipe rows:** 72pt rounded-16 thumbnail left, title 15pt/700 + meta 12pt/600 `herb` right,
  `chevron-forward` far right, 1px `#F4EFE8` divider.
- **Imported items** get an "Imported" badge above the title: `accentBg` pill, `accent` text,
  10pt/700 UPPERCASE, `sparkles` glyph. Imported rows navigate with the full `recipe` param;
  feed-saved rows navigate with `id`.

### 6. Share-to-import flow → `screens/ShareImportScreen.js` (modal)
Three states, all in one modal screen. Header: "Import recipe" 16pt/700 + `close`.
- **`loading`:** centered. 84pt white rounded-24 tile with a spinning accent ring
  (`#FFE0D9` track, `accent` head, 1s linear) + `sparkles` glyph. "Reading the post…" 22pt/800,
  sub 15pt/500 `muted`, and the shared URL in a monospace pill with a `link` icon.
- **`ready`:** editable draft. "Recipe found" herb check-pill. Title in a **focused** input
  (1.5px `ink` border, pencil icon). "Ingredients · n" label, then editable rows (drag handle
  left, name, measure, + an accent "Add ingredient" row). "Steps · n" with numbered steps.
  Pinned bottom: outlined "Discard" + flex accent "Save to my recipes".
- **`needs_caption`:** an `accentSoft`/`#FFE0D9` notice ("This link had no recipe text" + why —
  Reels keep recipes in audio / login walls), then a tall multiline paste box (`bg` fill, radius
  16), and a full-width accent "Extract recipe" button with `sparkles`. Re-calls
  `extractRecipe({ url, text: pasted })`.

---

## Navigation → `navigation/RootNavigator.js`
- **Bottom tabs:** Feed (`home`), Search (`search`), Saved (`bookmark`). Active = `ink`,
  inactive = `inactive` (#B6AEA4). Labels 10pt; active 700, inactive 600. 1px `line` top border.
- **Stack:** Detail (card push), **Folder** (push), and **ShareImport** as a `presentation:'modal'`.
- Share routing (per brief): `useShareIntentContext()` → route `webUrl || text` to ShareImport,
  then `resetShareIntent()`.

## Interactions & states
- **Save toggle:** bookmark outline → filled `ink` (card) / heart outline → filled `accent`.
  On save from Detail, present a folder picker sheet (list of folders + "New folder").
- **Folders (new state):** add `folders` to `SavedContext` — `{ id, name, recipeIds:[] }`,
  persisted under `@plated:folders`. Expose `createFolder, addToFolder, folders`. Folder covers
  derive their 2×2 collage from the first 4 members' thumbs.
- **Debounced search** ~350ms. **Pull-to-refresh** on Feed.
- **Import:** `loading` → `ready` | `needs_caption` (on empty/422). Save builds
  `id: 'imported-${Date.now()}'`, `addImported(it)`, then `navigation.replace('Detail',{id,recipe})`.
- Transitions are standard React Navigation defaults; the spinner ring is the only custom
  animation (rotate, 1s linear, infinite).

## Image guidance (replaces the gradient placeholders)
Every gradient block in the mock = a real food photo. Feed/detail/search/folder thumbs come from
TheMealDB `thumb` (`strMealThumb`). Imported recipes use the `og:image` the Worker returns.
Use `resizeMode="cover"`. Author avatars have no API source — a neutral circle or initials is fine.

## Starter source files (`starter/`)
Drop-in React Native files to copy into `src/`:
- `starter/theme.js` → `src/theme.js` — all tokens, type, shadow, radii (ready to use).
- `starter/RecipeCard.js` → `src/components/RecipeCard.js` — the Direction A feed card, wired for
  `recipe`, `onPress`, `isSaved`, `onToggleSave`. Assumes `@expo/vector-icons` and a `recipe`
  shape of `{ id, title, thumb, category, area?, cookTime?, author? }`. (TheMealDB has no author or
  numeric cook time — supply your own defaults or omit those chips.)

## Files
- `RecipeNest App Design.dc.html` — the full design reference (open in a browser). Sections, in order:
  Design system (palette/type/icons/components), Core screens (Feed, Detail, Search, Saved/Folders,
  Folder detail), Share-to-import (loading, editable draft, paste fallback), and two feed-card
  directions (A social / B editorial). The build uses **Direction A** for the feed.

## Out of scope (per brief)
Auth, cloud sync, Reels audio transcription, user-generated posts, likes/comments. The like icon
in the card is visual only for now.
