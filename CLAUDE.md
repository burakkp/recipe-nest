# Plated — Build Brief (paste into Claude Code, or save as CLAUDE.md)

You are building a mobile recipe app from an empty folder. Read this whole brief, then
**propose a short build plan and wait for my confirmation** before scaffolding. After I
confirm, build incrementally — one module at a time — and tell me what to run to verify
each step. Don't generate the entire app in one shot.

---

## What we're building
**Plated** — an Instagram-style food recipe app. A vertical card feed, recipe detail,
search, and saved recipes. The headline feature: **import a recipe by sharing a post into
the app** from the OS share sheet, then auto-structuring it with an LLM.

## Stack (free-first — this is a hard requirement)
- **App:** React Native + Expo (managed), React Navigation v6, JavaScript (not TS).
- **Recipe data:** TheMealDB free API (`https://www.themealdb.com/api/json/v1/1`, test key `1`, no signup).
- **Local storage:** `@react-native-async-storage/async-storage` (saves persist on-device).
- **Share target:** `expo-share-intent`.
- **Backend:** a **Cloudflare Worker** (free tier) for recipe extraction. LLM runs on
  **Cloudflare Workers AI** (free Llama, no API key, no credit card).
- **No AWS, no paid services.** Keep migration seams (see below) so we can move later.

## Hard realities to respect (do not design around these incorrectly)
1. **Instagram shares a LINK, not media.** The share sheet gives the app a URL like
   `https://instagram.com/reel/abc`, never the photo/video/caption. So the Worker must try
   to resolve the link (Open Graph tags), and the app must offer a **paste-the-caption
   fallback** when the link yields no usable text (login walls, Reels where the recipe is spoken).
2. **Share targets need an EAS dev build, NOT Expo Go.** Make this clear in the README and
   don't claim it works in Expo Go.
3. **Free LLM quality is a notch below Claude.** Fine for an MVP. Keep the LLM call behind a
   single swappable function with a commented Claude stub for later.

## Migration seams (build these in deliberately)
- The app knows the backend by **one constant** (`EXTRACT_ENDPOINT`). Host swap = one line.
- The Worker isolates the model in **one function** (`callLLM`). Provider swap = one function.
- Recipe data access lives in **one file** (`src/api/mealdb.js`). Provider swap = one file.

---

## Target file structure
```
App.js                      # providers + navigation + share-intent handler
app.json                    # expo config incl. expo-share-intent plugin + scheme
eas.json                    # dev/preview/production build profiles
src/
  theme.js                  # design tokens
  api/mealdb.js             # TheMealDB layer (feed, detail, search) + ingredient normalize
  api/extract.js            # POST shared content to the Worker -> structured recipe
  context/SavedContext.js   # saved (feed) + imported (full) recipes, AsyncStorage-persisted
  navigation/RootNavigator.js  # bottom tabs (Feed/Search/Saved) + Detail + ShareImport stack
  components/RecipeCard.js   # the feed card
  screens/FeedScreen.js      # category chips + feed list
  screens/DetailScreen.js    # ingredients + numbered method; renders a passed recipe OR fetches by id
  screens/SearchScreen.js    # debounced search
  screens/SavedScreen.js     # saved + imported (imported get an "Imported" badge)
  screens/ShareImportScreen.js # receives share, extracts, editable draft, paste fallback, save
worker/
  src/index.js              # Cloudflare Worker: OG resolve + Workers AI extraction
  wrangler.toml             # [ai] binding + MODEL var
  package.json
README.md
```

## Design tokens (use exactly — defined in src/theme.js)
Food apps live on their photography, so keep chrome minimal and let edge-to-edge food
imagery be the hero. One warm accent for save/like, a green for tags/time.
```
bg:    #FBF8F4   screen: #FFFFFF   ink:  #1A1714   muted: #8A817A
accent:#FF4D2E (likes/saves)       herb: #2E7D4F (tags/cook time)
line:  #EFE9E1   chip: #F4EFE8     radius: 8/12/20
```
Card layout mirrors Instagram: avatar + handle row, 1:1 image, action row
(heart, comment, spacer, bookmark), then title + meta tags.

---

## Build order & per-module specs

**1. Scaffold.** `npx create-expo-app@latest . --template blank`, then init git + a sensible
`.gitignore`. Install: `@react-navigation/native @react-navigation/native-stack
@react-navigation/bottom-tabs react-native-screens react-native-safe-area-context
@react-native-async-storage/async-storage @expo/vector-icons expo-share-intent`.

**2. `src/api/mealdb.js`.** Endpoints: `filter.php?c={category}` (feed: id/title/thumb only),
`lookup.php?i={id}` (full detail), `search.php?s={term}`. Export `CATEGORIES =
['Beef','Chicken','Seafood','Pasta','Dessert','Vegetarian','Breakfast']`. **Normalize**
TheMealDB's `strIngredient1..20` + `strMeasure1..20` into `ingredients:[{name,measure}]`,
and split `strInstructions` on newlines into `steps:[]` (drop empties). Detail object shape:
`{id,title,thumb,category,area,ingredients,instructions,source}`.

**3. `src/theme.js`.** The tokens above.

**4. `src/context/SavedContext.js`.** Two AsyncStorage-backed maps: `saved` (`{id,title,thumb}`
from the feed, key `@plated:saved`) and `imported` (full recipe objects, key `@plated:imported`).
Hydrate on mount, persist on change after a `hydrated` flag. Expose
`isSaved, toggleSave, addImported, saved, imported`.

**5. `components/RecipeCard.js` + `screens/FeedScreen.js`.** Card per design tokens. Feed has a
horizontal category chip strip (active chip = ink bg, white text), loads `fetchByCategory`,
pull-to-refresh, loading + error states. Tapping image/title → `navigation.navigate('Detail', {id, title})`.

**6. `screens/DetailScreen.js`.** Accept `route.params.recipe` (full object — render directly,
skip fetch) OR `route.params.id` (fetch via `lookup`). Hero image, save button, ingredients
(name left / measure right), numbered method steps, optional source link.

**7. `screens/SearchScreen.js`.** TextInput with ~350ms debounce → `searchRecipes`. Empty,
loading, no-results states. Results reuse `RecipeCard`.

**8. `screens/SavedScreen.js`.** List `imported` (full, tagged `_imported:true`, "Imported"
badge) then `saved`. Imported items navigate with the full `recipe` param; feed saves with `id`.
Empty state with a bookmark icon.

**9. Navigation (`RootNavigator.js`) + `App.js`.** Bottom tabs Feed/Search/Saved (Ionicons:
home/search/bookmark) + a stack with Detail and a modal `ShareImport`. In `App.js`, wrap with
`ShareIntentProvider` (from expo-share-intent) and `SafeAreaProvider`; a small handler component
uses `useShareIntentContext()` and a `navigationRef` to route incoming shares
(`shareIntent.webUrl || shareIntent.text`) to `ShareImport`, then `resetShareIntent()`.

**10. Share-intent native config (`app.json` + `eas.json`).** Add a `scheme`, iOS/Android
package ids, and the `expo-share-intent` plugin with activation rules for web URL / text /
image / movie (iOS) and `text/*`, `image/*`, `video/*` intent filters (Android). `eas.json`
with development (developmentClient + internal) / preview / production profiles.

**11. `src/api/extract.js`.** `extractRecipe({url, text})` → `POST` JSON to `EXTRACT_ENDPOINT`
(a single top-level constant pointing at the `workers.dev` URL). Returns
`{title, image, area, category, ingredients:[{name,measure}], steps:[], sourceUrl}`.

**12. `screens/ShareImportScreen.js`.** On mount, call `extractRecipe` with the shared
`{url,text}`. States: `loading` → `ready` (editable draft: title input, ingredient list, step
list, "Save to my recipes" + "Discard") or `needs_caption` (when extraction returns empty /
422 — show a multiline paste box + "Extract recipe" to retry with `{url, text: pasted}`).
On save, build a full recipe with id `imported-${Date.now()}`, `addImported(it)`, then
`navigation.replace('Detail', {id, recipe})`.

**13. `worker/` (Cloudflare Worker).** `fetch` handler, POST `/`:
   - Parse `{url, text}`. If `url`, fetch it with a browser UA and regex out `og:image`,
     `og:title`, `og:description`. Join available title+description+text as the source.
   - If no source text → `422 {error:'no_text', image, sourceUrl}` (the app's paste fallback).
   - Else `callLLM(env, source)` → parse strict JSON → return
     `{...recipe, image, sourceUrl}`. CORS on all responses incl. OPTIONS preflight.
   - `callLLM` default: `env.AI.run(env.MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
     {max_tokens:1500, messages:[{role:'system',content:SYSTEM},{role:'user',content:text}]})`,
     return `out.response`. **Include a commented Claude stub** (fetch to
     `api.anthropic.com/v1/messages`, model `claude-sonnet-4-6`, `x-api-key` from env) as the
     documented migration path.
   - SYSTEM prompt: convert a messy food caption into ONLY valid JSON
     `{"title","area","category","ingredients":[{"name","measure"}],"steps":[]}`; unknown
     fields empty; if not a recipe, return empty title/arrays.
   - `wrangler.toml`: `[ai] binding="AI"`, `[vars] MODEL=...`. `package.json` with
     `wrangler` + `dev`/`deploy` scripts.

**14. README.md.** Run steps (app: `npx eas build --profile development` → `expo start
--dev-client`; worker: `wrangler login` → `wrangler deploy`, paste the URL into `extract.js`).
A free-stack table with migration targets, and the three honest limits (dev build required,
Llama < Claude quality, 10k inferences/day cap on Workers AI free).

---

## Done when
- `npx expo start` launches; feed loads live recipes; category chips switch; search works;
  tapping a recipe shows ingredients + steps; save/unsave persists across a restart.
- `npx wrangler deploy` succeeds; `curl -X POST <url> -d '{"text":"<a recipe caption>"}'`
  returns structured JSON.
- A dev build registers Plated as a share target; sharing a link opens the import flow; the
  paste fallback works when the link has no caption; saved imports appear in Saved with the badge.

## Out of scope (note as future, don't build now)
Auth, cloud sync, Reels audio transcription, user-generated posts, likes/comments.

## Style
Concise, idiomatic React Native. Small focused components. Comment only the non-obvious
(the ingredient normalization, the share routing, the `callLLM` swap point). Ask before
adding any dependency not listed above.