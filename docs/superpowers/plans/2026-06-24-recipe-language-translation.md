# Recipe Language Translation Implementation Plan

> **For agentic workers:** Use `/subagent-dev` (recommended) or `/executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recipes display in whatever language they were originally shared in by default, and a language picker (English/Dutch/German/Turkish/Italian/Spanish) lets the user translate the display — on both the Detail screen and the import draft screen — with translations cached so repeat views don't re-call the LLM.

**Architecture:** The worker's extraction prompt stops force-translating to English and instead returns a `language` field (the detected source language). A new `/translate` route on the same worker takes a structured recipe + target language code and returns the same shape translated, reusing the existing `callLLM`/`parseRecipeJSON`/`normalizeRecipe` machinery (generalizing `callLLM` to accept an explicit system prompt). On the app side, a new `TranslationsContext` (AsyncStorage-backed, same hydrate/persist pattern as `SavedContext`) caches `{ [recipeId]: { [langCode]: translatedFields } }`. A shared `LanguagePicker` component is wired into both `DetailScreen.js` (any saved/MealDB recipe — MealDB recipes have no `language` field and are treated as `'en'`, so no changes needed to `mealdb.js`) and `ShareImportScreen.js` (the import draft, where editing is only enabled while viewing the original language; translated previews are read-only).

**Tech Stack:** Cloudflare Workers (vanilla JS), Workers AI binding, React Native/Expo, AsyncStorage. No test runner is installed (no Jest/Vitest) — verification uses standalone Node scripts mocking `env.AI`/`fetch` (same pattern used throughout this project), `npx expo export --platform android` for bundle verification, and live `curl` tests against the deployed worker with manual Cloudflare-dashboard deploy confirmation (no local `CLOUDFLARE_API_TOKEN`).

---

### Task 1: Worker — stop forcing English, add a `language` field to extraction

**Files:**
- Modify: `worker/src/index.js` (`SYSTEM_PROMPT`, `normalizeRecipe`)

- [ ] **Step 1: Replace `SYSTEM_PROMPT`**

Find:
```javascript
const SYSTEM_PROMPT = `You convert a messy food caption into structured recipe JSON.
Return ONLY valid JSON, no markdown, no commentary, in this exact shape:
{"title": "", "area": "", "category": "", "description": "", "ingredients": [{"name": "", "measure": ""}], "steps": []}
Rules:
- Read the entire text carefully and capture every ingredient and every step mentioned —
  do not stop early or summarize/merge multiple ingredients or steps into one.
- Each ingredient line becomes its own entry; keep its exact quantity/unit in "measure"
  (e.g. "2 cups", "1 tbsp") instead of dropping or vaguely paraphrasing it.
- Preserve the order steps are described in. Each "steps" array entry must be one plain
  string (never an object) describing one distinct instruction.
- Fill in only what you can confidently infer from the text — don't invent ingredients,
  quantities, or steps that aren't stated or clearly implied.
- "description" is a short 1-2 sentence summary of the dish, written by you (not copied
  verbatim from the source).
- If the source text is not in English, translate "title", "description", every
  ingredient "name", and every "steps" entry into English. Keep numbers/quantities in
  "measure" accurate through the translation.
- Leave unknown string fields as empty strings, unknown lists as empty arrays.
- "area" is a cuisine/region (e.g. "Italian"), "category" is a meal type (e.g. "Dessert").
- If the text is not a recipe at all, return title/description/ingredients/steps empty.`;
```

Replace with:
```javascript
const SYSTEM_PROMPT = `You convert a messy food caption into structured recipe JSON.
Return ONLY valid JSON, no markdown, no commentary, in this exact shape:
{"title": "", "area": "", "category": "", "description": "", "language": "en", "ingredients": [{"name": "", "measure": ""}], "steps": []}
Rules:
- Read the entire text carefully and capture every ingredient and every step mentioned —
  do not stop early or summarize/merge multiple ingredients or steps into one.
- Each ingredient line becomes its own entry; keep its exact quantity/unit in "measure"
  (e.g. "2 cups", "1 tbsp") instead of dropping or vaguely paraphrasing it.
- Preserve the order steps are described in. Each "steps" array entry must be one plain
  string (never an object) describing one distinct instruction.
- Fill in only what you can confidently infer from the text — don't invent ingredients,
  quantities, or steps that aren't stated or clearly implied.
- "description" is a short 1-2 sentence summary of the dish, written by you (not copied
  verbatim from the source).
- Keep "title", "description", every ingredient "name", and every "steps" entry in the
  SAME language as the source text — do not translate them.
- "language" is the ISO 639-1 code of the language the source text is written in (e.g.
  "en", "tr", "de", "nl", "it", "es"). Default to "en" if you cannot tell.
- Leave unknown string fields as empty strings, unknown lists as empty arrays.
- "area" is a cuisine/region (e.g. "Italian"), "category" is a meal type (e.g. "Dessert").
- If the text is not a recipe at all, return title/description/ingredients/steps empty.`;
```

- [ ] **Step 2: Add `language` to `normalizeRecipe`**

Find:
```javascript
function normalizeRecipe(recipe) {
  return {
    title: typeof recipe.title === 'string' ? recipe.title : '',
    area: typeof recipe.area === 'string' ? recipe.area : '',
    category: typeof recipe.category === 'string' ? recipe.category : '',
    description: typeof recipe.description === 'string' ? recipe.description : '',
    ingredients: Array.isArray(recipe.ingredients)
```

Replace with:
```javascript
function normalizeRecipe(recipe) {
  return {
    title: typeof recipe.title === 'string' ? recipe.title : '',
    area: typeof recipe.area === 'string' ? recipe.area : '',
    category: typeof recipe.category === 'string' ? recipe.category : '',
    description: typeof recipe.description === 'string' ? recipe.description : '',
    language: typeof recipe.language === 'string' && recipe.language ? recipe.language : 'en',
    ingredients: Array.isArray(recipe.ingredients)
```

- [ ] **Step 3: Write the verification script**

```bash
cat > /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/test-task1.mjs << 'EOF'
const worker = (await import('/home/burakkp/Documents/Projects/RecipeNest/worker/src/index.js')).default;
const env = {
  MODEL: 'test-model',
  AI: {
    run: async () => ({
      response: {
        title: 'Sosis',
        area: 'Turkish',
        category: '',
        description: 'Ev yapımı sosis tarifi.',
        language: 'tr',
        ingredients: [{ name: 'Dana kıyma', measure: '200gr' }],
        steps: ['Kıymayı baharatlarla yoğurun.'],
      },
    }),
  },
};
const res = await worker.fetch(new Request('http://x/', {
  method: 'POST',
  body: JSON.stringify({ text: 'Sosis tarifi: 200gr dana kıyma. Kıymayı baharatlarla yoğurun.' }),
}), env);
const body = await res.json();
console.log('status:', res.status);
console.log('language field present:', body.language === 'tr');
console.log('title NOT translated:', body.title === 'Sosis');
console.log(JSON.stringify(body));
EOF
node /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/test-task1.mjs
```

Expected: `language field present: true`, `title NOT translated: true`.

- [ ] **Step 4: Clean up and commit**

```bash
rm /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/test-task1.mjs
git add worker/src/index.js
git commit -m "feat: stop force-translating extracted recipes, detect source language instead"
```

---

### Task 2: Worker — generalize `callLLM` to accept an explicit system prompt

**Files:**
- Modify: `worker/src/index.js` (`callLLM` function and its one call site)

- [ ] **Step 1: Update `callLLM`'s signature**

Find:
```javascript
// Swap point for a different model/provider — keep the signature (env, source) -> string.
async function callLLM(env, source) {
  const out = await env.AI.run(env.MODEL || '@cf/meta/llama-3.1-8b-instruct-fast', {
    max_tokens: 1500,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: source },
    ],
  });
  return out.response;

  // --- Claude migration stub ---
  // const res = await fetch('https://api.anthropic.com/v1/messages', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'x-api-key': env.ANTHROPIC_API_KEY,
  //     'anthropic-version': '2023-06-01',
  //   },
  //   body: JSON.stringify({
  //     model: 'claude-sonnet-4-6',
  //     max_tokens: 1500,
  //     system: SYSTEM_PROMPT,
  //     messages: [{ role: 'user', content: source }],
  //   }),
  // });
  // const data = await res.json();
  // return data.content[0].text;
}
```

Replace with:
```javascript
// Swap point for a different model/provider — keep the signature
// (env, systemPrompt, source) -> string. systemPrompt is explicit so this same
// function serves both extraction and translation (different prompts, same model call).
async function callLLM(env, systemPrompt, source) {
  const out = await env.AI.run(env.MODEL || '@cf/meta/llama-3.1-8b-instruct-fast', {
    max_tokens: 1500,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: source },
    ],
  });
  return out.response;

  // --- Claude migration stub ---
  // const res = await fetch('https://api.anthropic.com/v1/messages', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'x-api-key': env.ANTHROPIC_API_KEY,
  //     'anthropic-version': '2023-06-01',
  //   },
  //   body: JSON.stringify({
  //     model: 'claude-sonnet-4-6',
  //     max_tokens: 1500,
  //     system: systemPrompt,
  //     messages: [{ role: 'user', content: source }],
  //   }),
  // });
  // const data = await res.json();
  // return data.content[0].text;
}
```

- [ ] **Step 2: Update the one existing call site**

Find:
```javascript
    const raw = await callLLM(env, source);
    const recipe = normalizeRecipe(
      parseRecipeJSON(raw) || { title: '', area: '', category: '', ingredients: [], steps: [] }
    );

    return json({ ...recipe, image, video, handle, sourceUrl });
```

Replace with:
```javascript
    const raw = await callLLM(env, SYSTEM_PROMPT, source);
    const recipe = normalizeRecipe(
      parseRecipeJSON(raw) || { title: '', area: '', category: '', ingredients: [], steps: [] }
    );

    return json({ ...recipe, image, video, handle, sourceUrl });
```

- [ ] **Step 3: Verify with the existing regression script**

```bash
cat > /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/test-task2.mjs << 'EOF'
const worker = (await import('/home/burakkp/Documents/Projects/RecipeNest/worker/src/index.js')).default;
const env = {
  MODEL: 'test-model',
  AI: { run: async (model, input) => {
    if (input.messages[0].content.includes('You convert a messy food caption')) {
      return { response: { title: 'Pancakes', area: '', category: '', description: '', language: 'en', ingredients: [{name:'flour',measure:'2 cups'}], steps: ['Mix.'] } };
    }
    throw new Error('unexpected system prompt: ' + input.messages[0].content.slice(0, 40));
  }},
};
const res = await worker.fetch(new Request('http://x/', { method: 'POST', body: JSON.stringify({ text: 'Pancakes: 2 cups flour. Mix.' }) }), env);
console.log('status:', res.status, await res.json());
EOF
node /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/test-task2.mjs
```

Expected: `status: 200` with the Pancakes body — confirms the extraction path still passes `SYSTEM_PROMPT` correctly through the new parameter.

- [ ] **Step 4: Clean up and commit**

```bash
rm /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/test-task2.mjs
git add worker/src/index.js
git commit -m "refactor: make callLLM take an explicit system prompt"
```

---

### Task 3: Worker — add the `/translate` route

**Files:**
- Modify: `worker/src/index.js` (add `LANGUAGE_NAMES`, `buildTranslatePrompt`, `handleTranslate`, and routing in the `fetch` handler)

- [ ] **Step 1: Add `LANGUAGE_NAMES` and `buildTranslatePrompt` after `VISION_PROMPT`**

Find:
```javascript
const VISION_PROMPT = `Transcribe every piece of text visible in this image exactly as
written, in its original language — including any title, caption, ingredient list with
quantities, and numbered or bulleted steps. Read carefully line by line; do not skip or
summarize any text, even if it is a long paragraph. If the image is a photo of a finished
dish with little or no text, instead describe the dish and any visible ingredients in
detail. Output plain text only, in the original language (do not translate here).`;
```

Add immediately after it:
```javascript

const LANGUAGE_NAMES = {
  en: 'English',
  nl: 'Dutch',
  de: 'German',
  tr: 'Turkish',
  it: 'Italian',
  es: 'Spanish',
};

function buildTranslatePrompt(targetLanguage) {
  const languageName = LANGUAGE_NAMES[targetLanguage];
  return `You translate a structured recipe JSON into ${languageName}.
You will receive JSON in this exact shape:
{"title": "", "area": "", "category": "", "description": "", "ingredients": [{"name": "", "measure": ""}], "steps": []}
Return ONLY valid JSON in the exact same shape, no markdown, no commentary.
Rules:
- Translate "title", "description", every ingredient "name", "area", and "category" into ${languageName}.
- Translate every "steps" entry into ${languageName}, preserving the same number of steps in the same order.
- Keep numeric quantities in "measure" unchanged; translate only unit words (e.g. "cups" ->
  the ${languageName} word for cups). If "measure" has no unit words, leave it as-is.
- Do not add, remove, or merge ingredients or steps — the output arrays must have the same
  length as the input.
- Leave any field that was already empty in the input as empty in the output.`;
}
```

- [ ] **Step 2: Add `handleTranslate` after `callVisionLLM`**

Find:
```javascript
async function callVisionLLM(env, bytes) {
  const out = await env.AI.run(env.VISION_MODEL || '@cf/meta/llama-3.2-11b-vision-instruct', {
    image: bytes,
    prompt: VISION_PROMPT,
    max_tokens: 1024,
  });
  // Vision-instruct chat models return `.response`; image-captioning models
  // (e.g. LLaVA) return `.description` — accept either shape.
  return out.response || out.description || '';
}
```

Add immediately after it:
```javascript

async function handleTranslate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'invalid_json' }, 400);
  }

  const { recipe, targetLanguage } = body || {};
  if (!recipe || typeof recipe !== 'object') {
    return json({ error: 'missing_recipe' }, 400);
  }
  if (!targetLanguage || !LANGUAGE_NAMES[targetLanguage]) {
    return json({ error: 'unsupported_language' }, 400);
  }

  const source = JSON.stringify({
    title: recipe.title || '',
    area: recipe.area || '',
    category: recipe.category || '',
    description: recipe.description || '',
    ingredients: recipe.ingredients || [],
    steps: recipe.steps || [],
  });

  const raw = await callLLM(env, buildTranslatePrompt(targetLanguage), source);
  const translated = normalizeRecipe(
    parseRecipeJSON(raw) || { title: '', area: '', category: '', description: '', ingredients: [], steps: [] }
  );

  return json({ ...translated, language: targetLanguage });
}
```

- [ ] **Step 3: Route `/translate` requests to it**

Find:
```javascript
    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405);
    }

    const contentType = request.headers.get('content-type') || '';
```

Replace with:
```javascript
    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405);
    }

    const { pathname } = new URL(request.url);
    if (pathname === '/translate') {
      return handleTranslate(request, env);
    }

    const contentType = request.headers.get('content-type') || '';
```

- [ ] **Step 4: Write the verification script**

```bash
cat > /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/test-task3.mjs << 'EOF'
const worker = (await import('/home/burakkp/Documents/Projects/RecipeNest/worker/src/index.js')).default;

const env = {
  MODEL: 'test-model',
  AI: {
    run: async (model, input) => {
      if (!input.messages[0].content.includes('translate a structured recipe JSON into Turkish')) {
        throw new Error('wrong system prompt: ' + input.messages[0].content.slice(0, 60));
      }
      return {
        response: {
          title: 'Tavuk Köri', area: 'Türk', category: 'Ana Yemek', description: 'Lezzetli bir tavuk köri.',
          ingredients: [{ name: 'Tavuk', measure: '500g' }], steps: ['Tavuğu pişirin.'],
        },
      };
    },
  },
};

const res = await worker.fetch(new Request('http://x/translate', {
  method: 'POST',
  body: JSON.stringify({
    recipe: { title: 'Chicken Curry', area: 'Indian', category: 'Main', description: 'A tasty chicken curry.', ingredients: [{ name: 'Chicken', measure: '500g' }], steps: ['Cook the chicken.'] },
    targetLanguage: 'tr',
  }),
}), env);
console.log('status:', res.status);
console.log(JSON.stringify(await res.json()));

const res2 = await worker.fetch(new Request('http://x/translate', {
  method: 'POST',
  body: JSON.stringify({ recipe: { title: 'X' }, targetLanguage: 'fr' }),
}), env);
console.log('unsupported language status:', res2.status, await res2.json());

const res3 = await worker.fetch(new Request('http://x/translate', {
  method: 'POST',
  body: JSON.stringify({ targetLanguage: 'tr' }),
}), env);
console.log('missing recipe status:', res3.status, await res3.json());
EOF
node /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/test-task3.mjs
```

Expected: first call returns `status: 200` with the Turkish-translated body plus `"language":"tr"`; second returns `status: 400` with `unsupported_language`; third returns `status: 400` with `missing_recipe`.

- [ ] **Step 5: Confirm the existing extract path still works (no routing regression)**

```bash
cat > /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/test-task3b.mjs << 'EOF'
const worker = (await import('/home/burakkp/Documents/Projects/RecipeNest/worker/src/index.js')).default;
const env = { MODEL: 'test-model', AI: { run: async () => ({ response: { title: 'Pancakes', area: '', category: '', description: '', language: 'en', ingredients: [], steps: [] } }) } };
const res = await worker.fetch(new Request('http://x/', { method: 'POST', body: JSON.stringify({ text: 'Pancakes: flour. Mix.' }) }), env);
console.log('status:', res.status, await res.json());
EOF
node /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/test-task3b.mjs
```

Expected: `status: 200` with the Pancakes body (the default `/` path is unaffected by the new routing check).

- [ ] **Step 6: Clean up and commit**

```bash
rm /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/test-task3.mjs /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/test-task3b.mjs
git add worker/src/index.js
git commit -m "feat: add /translate route for recipe language switching"
```

---

### Task 4: Worker — deploy and verify live

**Files:** none (deploy step only)

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Ask the user to confirm the Cloudflare dashboard build succeeded for `recipe-nest`** (git-connected Workers Build; no local `CLOUDFLARE_API_TOKEN` to check automatically).

- [ ] **Step 3: Verify extraction now returns the source language unchanged**

```bash
curl -s -X POST https://recipe-nest.burak-kucukparmaksiz.workers.dev/ -H "Content-Type: application/json" -d '{"text":"Sosis tarifi: 200gr dana kıyma, 1 çay kaşığı tuz. Kıymayı baharatlarla yoğurun."}' --max-time 30
```

Expected: `"language":"tr"` in the response, and `title`/`ingredients`/`steps` still in Turkish (not translated to English).

- [ ] **Step 4: Verify `/translate`**

```bash
curl -s -X POST https://recipe-nest.burak-kucukparmaksiz.workers.dev/translate -H "Content-Type: application/json" -d '{"recipe":{"title":"Sausage","area":"Turkish","category":"","description":"A homemade sausage recipe.","ingredients":[{"name":"Ground beef","measure":"200g"}],"steps":["Mix the beef with spices."]},"targetLanguage":"de"}' --max-time 30
```

Expected: `HTTP 200` with German-translated `title`/`description`/ingredient `name`/`steps`, and `"language":"de"`.

---

### Task 5: App — add the supported-languages constant

**Files:**
- Create: `src/constants/languages.js`

- [ ] **Step 1: Create the file**

```javascript
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Dutch' },
  { code: 'de', label: 'German' },
  { code: 'tr', label: 'Turkish' },
  { code: 'it', label: 'Italian' },
  { code: 'es', label: 'Spanish' },
];

export function getLanguageLabel(code) {
  const match = SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
  return match ? match.label : code;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/constants/languages.js
git commit -m "feat: add supported-languages constant"
```

---

### Task 6: App — add `translateRecipe` to the extract API

**Files:**
- Modify: `src/api/extract.js`

- [ ] **Step 1: Add the function**

Append to the end of the file:
```javascript

export async function translateRecipe({ recipe, targetLanguage }) {
  const res = await fetch(`${EXTRACT_ENDPOINT}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipe, targetLanguage }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'translate_failed');
  }

  return data;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/api/extract.js
git commit -m "feat: add translateRecipe to the extract API client"
```

---

### Task 7: App — add `TranslationsContext` and wire it into `App.js`

**Files:**
- Create: `src/context/TranslationsContext.js`
- Modify: `App.js`

- [ ] **Step 1: Create the context**

```javascript
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
```

- [ ] **Step 2: Wire the provider into `App.js`**

Find:
```javascript
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { SavedProvider } from './src/context/SavedContext';
import RootNavigator from './src/navigation/RootNavigator';
```

Replace with:
```javascript
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { SavedProvider } from './src/context/SavedContext';
import { TranslationsProvider } from './src/context/TranslationsContext';
import RootNavigator from './src/navigation/RootNavigator';
```

Find:
```javascript
      <ShareIntentProvider>
        <SavedProvider>
          <NavigationContainer ref={navigationRef}>
            <ShareIntentHandler />
            <RootNavigator />
          </NavigationContainer>
          <StatusBar style="auto" />
        </SavedProvider>
      </ShareIntentProvider>
```

Replace with:
```javascript
      <ShareIntentProvider>
        <SavedProvider>
          <TranslationsProvider>
            <NavigationContainer ref={navigationRef}>
              <ShareIntentHandler />
              <RootNavigator />
            </NavigationContainer>
            <StatusBar style="auto" />
          </TranslationsProvider>
        </SavedProvider>
      </ShareIntentProvider>
```

- [ ] **Step 3: Verify by bundling**

```bash
npx expo export --platform android --output-dir /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/verify-task7 2>&1 | tail -10
rm -rf /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/verify-task7
```

Expected: `Android Bundled` with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/context/TranslationsContext.js App.js
git commit -m "feat: add TranslationsContext for caching per-recipe translations"
```

---

### Task 8: App — add the reusable `LanguagePicker` component

**Files:**
- Create: `src/components/LanguagePicker.js`

- [ ] **Step 1: Create the component**

```javascript
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
```

- [ ] **Step 2: Verify by bundling**

```bash
npx expo export --platform android --output-dir /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/verify-task8 2>&1 | tail -10
rm -rf /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/verify-task8
```

Expected: `Android Bundled` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/LanguagePicker.js
git commit -m "feat: add reusable LanguagePicker component"
```

---

### Task 9: App — wire language switching into `DetailScreen.js`

**Files:**
- Modify: `src/screens/DetailScreen.js`

- [ ] **Step 1: Add imports**

Find:
```javascript
import { useEffect, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchRecipeById } from '../api/mealdb';
import { useSaved } from '../context/SavedContext';
import { colors, radius, shadow, spacing, type } from '../theme';
```

Replace with:
```javascript
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchRecipeById } from '../api/mealdb';
import { translateRecipe } from '../api/extract';
import { useSaved } from '../context/SavedContext';
import { useTranslations } from '../context/TranslationsContext';
import LanguagePicker from '../components/LanguagePicker';
import { colors, radius, shadow, spacing, type } from '../theme';
```

- [ ] **Step 2: Add state/hooks and the fetch-time language sync (before the early returns, to respect React's rules of hooks)**

Find:
```javascript
  const { recipe: passedRecipe, id } = route.params || {};
  const [recipe, setRecipe] = useState(passedRecipe || null);
  const [loading, setLoading] = useState(!passedRecipe);
  const [error, setError] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const { isSaved, toggleSave } = useSaved();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (passedRecipe) return;
    let active = true;
    setLoading(true);
    fetchRecipeById(id)
      .then((data) => {
        if (active) setRecipe(data);
      })
      .catch(() => {
        if (active) setError('Could not load this recipe.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, passedRecipe]);
```

Replace with:
```javascript
  const { recipe: passedRecipe, id } = route.params || {};
  const [recipe, setRecipe] = useState(passedRecipe || null);
  const [loading, setLoading] = useState(!passedRecipe);
  const [error, setError] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [activeLang, setActiveLang] = useState(passedRecipe?.language || 'en');
  const [translating, setTranslating] = useState(false);
  const { isSaved, toggleSave } = useSaved();
  const { getCachedTranslation, setCachedTranslation } = useTranslations();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (passedRecipe) return;
    let active = true;
    setLoading(true);
    fetchRecipeById(id)
      .then((data) => {
        if (active) {
          setRecipe(data);
          if (data) setActiveLang(data.language || 'en');
        }
      })
      .catch(() => {
        if (active) setError('Could not load this recipe.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, passedRecipe]);
```

- [ ] **Step 3: Add `displayRecipe` and `handleLanguageChange` after the early returns**

Find:
```javascript
  const saved = isSaved(recipe.id);

  return (
```

Replace with:
```javascript
  const saved = isSaved(recipe.id);
  const originalLanguage = recipe.language || 'en';
  const cached = activeLang !== originalLanguage ? getCachedTranslation(recipe.id, activeLang) : null;
  const displayRecipe = cached || {
    title: recipe.title,
    description: recipe.description || '',
    area: recipe.area || '',
    category: recipe.category || '',
    ingredients: recipe.ingredients || [],
    steps: recipe.steps || [],
  };

  function handleLanguageChange(langCode) {
    if (langCode === originalLanguage || getCachedTranslation(recipe.id, langCode)) {
      setActiveLang(langCode);
      return;
    }
    setTranslating(true);
    translateRecipe({
      recipe: {
        title: recipe.title,
        description: recipe.description || '',
        area: recipe.area || '',
        category: recipe.category || '',
        ingredients: recipe.ingredients || [],
        steps: recipe.steps || [],
      },
      targetLanguage: langCode,
    })
      .then((data) => {
        setCachedTranslation(recipe.id, langCode, data);
        setActiveLang(langCode);
      })
      .catch(() => {
        Alert.alert('Translation failed', 'Could not translate this recipe right now.');
      })
      .finally(() => setTranslating(false));
  }

  return (
```

- [ ] **Step 4: Render the picker and switch the translatable fields to `displayRecipe`**

Find:
```javascript
          <Text style={styles.title}>{recipe.title}</Text>
          {!!recipe.handle && <Text style={styles.handle}>@{recipe.handle}</Text>}
          {!!recipe.description && <Text style={styles.description}>{recipe.description}</Text>}

          {(recipe.category || recipe.area) && (
            <View style={styles.tagsRow}>
              {recipe.area && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{recipe.area}</Text>
                </View>
              )}
              {recipe.category && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{recipe.category}</Text>
                </View>
              )}
            </View>
          )}

          <Text style={styles.sectionHeading}>Ingredients</Text>
          {(recipe.ingredients || []).map((ing, idx) => (
            <View
              key={`${ing.name}-${idx}`}
              style={[
                styles.ingredientRow,
                idx === recipe.ingredients.length - 1 && styles.noBorder,
              ]}
            >
              <Text style={styles.ingredientName}>{ing.name}</Text>
              <Text style={styles.ingredientMeasure}>{ing.measure}</Text>
            </View>
          ))}

          <Text style={styles.sectionHeading}>Method</Text>
          {(recipe.steps || []).map((step, idx) => (
            <View key={idx} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{idx + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
```

Replace with:
```javascript
          <Text style={styles.title}>{displayRecipe.title}</Text>
          {!!recipe.handle && <Text style={styles.handle}>@{recipe.handle}</Text>}
          {!!displayRecipe.description && (
            <Text style={styles.description}>{displayRecipe.description}</Text>
          )}

          <LanguagePicker value={activeLang} loading={translating} onChange={handleLanguageChange} />

          {(displayRecipe.category || displayRecipe.area) && (
            <View style={styles.tagsRow}>
              {displayRecipe.area && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{displayRecipe.area}</Text>
                </View>
              )}
              {displayRecipe.category && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{displayRecipe.category}</Text>
                </View>
              )}
            </View>
          )}

          <Text style={styles.sectionHeading}>Ingredients</Text>
          {displayRecipe.ingredients.map((ing, idx) => (
            <View
              key={`${ing.name}-${idx}`}
              style={[
                styles.ingredientRow,
                idx === displayRecipe.ingredients.length - 1 && styles.noBorder,
              ]}
            >
              <Text style={styles.ingredientName}>{ing.name}</Text>
              <Text style={styles.ingredientMeasure}>{ing.measure}</Text>
            </View>
          ))}

          <Text style={styles.sectionHeading}>Method</Text>
          {displayRecipe.steps.map((step, idx) => (
            <View key={idx} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{idx + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
```

- [ ] **Step 5: Verify by bundling**

```bash
npx expo export --platform android --output-dir /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/verify-task9 2>&1 | tail -10
rm -rf /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/verify-task9
```

Expected: `Android Bundled` with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/screens/DetailScreen.js
git commit -m "feat: add language picker and translation to Detail screen"
```

---

### Task 10: App — wire language switching into `ShareImportScreen.js`

**Files:**
- Modify: `src/screens/ShareImportScreen.js`

- [ ] **Step 1: Add imports**

Find:
```javascript
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
```

Replace with:
```javascript
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { extractRecipe, translateRecipe } from '../api/extract';
import { useSaved } from '../context/SavedContext';
import { useTranslations } from '../context/TranslationsContext';
import LanguagePicker from '../components/LanguagePicker';
import { colors, radius, spacing, type } from '../theme';
```

- [ ] **Step 2: Add state and update `runExtract` to capture `language` and reset per-session translations**

Find:
```javascript
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
          // The worker never echoes an image for a Story upload (it has no
          // hosted image to return) — fall back to the local shared file.
          image: data.image || payload.image?.path || '',
          video: data.video || '',
          handle: data.handle || '',
          description: data.description || '',
          area: data.area || '',
          category: data.category || '',
          ingredients: data.ingredients || [],
          steps: data.steps || [],
          sourceUrl: data.sourceUrl || payload.url || '',
        });
        setStatus('ready');
      })
```

Replace with:
```javascript
  const { addImported, addToFolder, DEFAULT_FOLDER_ID } = useSaved();
  const { setCachedTranslation } = useTranslations();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState('loading'); // loading | ready | needs_caption | error
  const [draft, setDraft] = useState(null);
  const [captionInfo, setCaptionInfo] = useState(null); // { image, video, handle, sourceUrl }
  const [pastedText, setPastedText] = useState('');
  const [activeLang, setActiveLang] = useState('en');
  const [translating, setTranslating] = useState(false);
  const [translatedDrafts, setTranslatedDrafts] = useState({});

  const runExtract = useCallback((payload) => {
    setStatus('loading');
    extractRecipe(payload)
      .then((data) => {
        setDraft({
          title: data.title || '',
          // The worker never echoes an image for a Story upload (it has no
          // hosted image to return) — fall back to the local shared file.
          image: data.image || payload.image?.path || '',
          video: data.video || '',
          handle: data.handle || '',
          description: data.description || '',
          language: data.language || 'en',
          area: data.area || '',
          category: data.category || '',
          ingredients: data.ingredients || [],
          steps: data.steps || [],
          sourceUrl: data.sourceUrl || payload.url || '',
        });
        setTranslatedDrafts({});
        setActiveLang(data.language || 'en');
        setStatus('ready');
      })
```

- [ ] **Step 3: Add `displayDraft`/`isOriginalLang`/`handleLanguageChange` and update `handleSave`**

Find:
```javascript
  function handleSave() {
    const recipe = {
      id: `imported-${Date.now()}`,
      title: draft.title,
      thumb: draft.image,
      video: draft.video,
      handle: draft.handle,
      description: draft.description,
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
```

Replace with:
```javascript
  const isOriginalLang = !draft || activeLang === draft.language;
  const displayDraft = draft && !isOriginalLang && translatedDrafts[activeLang]
    ? { ...draft, ...translatedDrafts[activeLang] }
    : draft;

  function handleLanguageChange(langCode) {
    if (langCode === draft.language || translatedDrafts[langCode]) {
      setActiveLang(langCode);
      return;
    }
    setTranslating(true);
    translateRecipe({
      recipe: {
        title: draft.title,
        description: draft.description,
        area: draft.area,
        category: draft.category,
        ingredients: draft.ingredients,
        steps: draft.steps,
      },
      targetLanguage: langCode,
    })
      .then((data) => {
        setTranslatedDrafts((prev) => ({ ...prev, [langCode]: data }));
        setActiveLang(langCode);
      })
      .catch(() => {
        Alert.alert('Translation failed', 'Could not translate this recipe right now.');
      })
      .finally(() => setTranslating(false));
  }

  function handleSave() {
    const recipe = {
      id: `imported-${Date.now()}`,
      title: draft.title,
      thumb: draft.image,
      video: draft.video,
      handle: draft.handle,
      description: draft.description,
      language: draft.language,
      area: draft.area,
      category: draft.category,
      ingredients: draft.ingredients,
      instructions: draft.steps.join('\n'),
      steps: draft.steps,
      source: draft.sourceUrl,
    };
    addImported(recipe);
    addToFolder(DEFAULT_FOLDER_ID, recipe);
    Object.entries(translatedDrafts).forEach(([langCode, data]) => {
      setCachedTranslation(recipe.id, langCode, data);
    });
    navigation.replace('Detail', { id: recipe.id, recipe });
  }
```

- [ ] **Step 4: Render the picker, and switch the "ready" branch to `displayDraft` with edits locked to the original language**

Find:
```javascript
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
          <TextInput
            style={styles.descriptionInput}
            value={draft.description}
            onChangeText={updateDescription}
            placeholder="Short description"
            placeholderTextColor={colors.muted}
            multiline
          />
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
```

Replace with:
```javascript
          {!!draft.video && (
            <TouchableOpacity onPress={() => Linking.openURL(draft.video)}>
              <Text style={styles.sourceLink}>Watch original video</Text>
            </TouchableOpacity>
          )}
          <LanguagePicker value={activeLang} loading={translating} onChange={handleLanguageChange} />
          <View style={styles.titleInputRow}>
            <TextInput
              style={styles.titleInput}
              value={displayDraft.title}
              onChangeText={updateTitle}
              editable={isOriginalLang}
              placeholder="Recipe title"
              placeholderTextColor={colors.muted}
            />
            <Ionicons name="pencil-outline" size={16} color={colors.muted} />
          </View>
          <TextInput
            style={styles.descriptionInput}
            value={displayDraft.description}
            onChangeText={updateDescription}
            editable={isOriginalLang}
            placeholder="Short description"
            placeholderTextColor={colors.muted}
            multiline
          />
          {(!!displayDraft.area || !!displayDraft.category) && (
            <View style={styles.chipRow}>
              {!!displayDraft.area && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{displayDraft.area}</Text>
                </View>
              )}
              {!!displayDraft.category && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{displayDraft.category}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      <View style={styles.formBody}>
        <Text style={styles.sectionHeading}>Ingredients · {displayDraft.ingredients.length}</Text>
        {displayDraft.ingredients.map((ing, idx) => (
          <View key={idx} style={styles.ingredientRow}>
            <TextInput
              style={[styles.input, styles.ingredientName]}
              value={ing.name}
              onChangeText={(value) => updateIngredient(idx, 'name', value)}
              editable={isOriginalLang}
              placeholder="Ingredient"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={[styles.input, styles.ingredientMeasure]}
              value={ing.measure}
              onChangeText={(value) => updateIngredient(idx, 'measure', value)}
              editable={isOriginalLang}
              placeholder="Measure"
              placeholderTextColor={colors.muted}
            />
          </View>
        ))}

        <Text style={styles.sectionHeading}>Steps · {displayDraft.steps.length}</Text>
        {displayDraft.steps.map((step, idx) => (
          <View key={idx} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{idx + 1}</Text>
            <TextInput
              style={[styles.input, styles.stepInput]}
              value={step}
              onChangeText={(value) => updateStep(idx, value)}
              editable={isOriginalLang}
              multiline
            />
          </View>
        ))}
```

- [ ] **Step 5: Verify by bundling**

```bash
npx expo export --platform android --output-dir /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/verify-task10 2>&1 | tail -10
rm -rf /tmp/claude-1000/-home-burakkp-Documents-Projects-RecipeNest/ef51164e-0c66-41ad-85c9-42638bd15a77/scratchpad/verify-task10
```

Expected: `Android Bundled` with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/screens/ShareImportScreen.js
git commit -m "feat: add language picker to the import draft screen"
```

---

### Task 11: Full end-to-end manual verification

**Files:** none (manual device test)

- [ ] **Step 1: Rebuild the release APK**

```bash
cd android
export ANDROID_HOME=/home/burakkp/Android/Sdk ANDROID_SDK_ROOT=/home/burakkp/Android/Sdk
./gradlew assembleRelease
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 2: Install on the physical device**

```bash
export PATH="$PATH:/home/burakkp/Android/Sdk/platform-tools"
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

- [ ] **Step 3: Test a non-English import**

Share a Turkish (or other non-English) Instagram post/screenshot into Plated. Expected: the import draft shows the recipe in the original language by default, with a language button showing that language.

- [ ] **Step 4: Test translating the draft**

Tap the language button, pick English. Expected: title/description/ingredients/steps switch to English, the fields become read-only (greyed/non-editable), and switching back to the original language re-enables editing.

- [ ] **Step 5: Save and confirm Detail screen**

Save the recipe. Expected: Detail screen opens showing the original language by default, with the same language picker; switching languages works and is instant on the second switch back to a previously-viewed language (cached).

- [ ] **Step 6: Test a MealDB feed recipe**

Open any recipe from the Feed/Search tabs (English, no `language` field). Expected: language picker still appears (defaulting to English), and picking e.g. Turkish translates it via the same flow.

- [ ] **Step 7: Restart the app and confirm cached translations persist**

Force-close and reopen the app, revisit a recipe previously translated. Expected: switching to that previously-viewed language is instant (no loading spinner) — confirms the AsyncStorage-backed cache survived the restart.
