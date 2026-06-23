# Instagram Import Fixes Implementation Plan

> **For agentic workers:** Use `/subagent-dev` (recommended) or `/executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the share-to-import pipeline so a shared Instagram link never silently produces a blank "recipe" when the page is blocked, and always lets the user reach the real post — plus surface whatever video/extra image data Instagram's Open Graph tags expose.

**Architecture:** All extraction logic lives in `worker/src/index.js` (the Cloudflare Worker). The root bug is that the worker currently treats *any* non-empty shared text — including a bare URL with no real caption — as legitimate recipe source text, so the LLM gets called on garbage input and dutifully returns an empty recipe (per its own system prompt instruction to return blanks when the input isn't a recipe) instead of the worker falling back to the existing `needs_caption` (422) path. We tighten what counts as "real" extracted text, add `og:video`/account-handle extraction, and thread `video`/`handle`/`sourceUrl` through `src/api/extract.js` → `ShareImportScreen.js` → `DetailScreen.js` so the original post is always one tap away.

**Tech Stack:** Cloudflare Workers (vanilla JS, no framework), Workers AI binding, React Native/Expo screens. No test runner is installed in this project (no Jest/Vitest) — verification uses standalone Node scripts that mock `fetch`/`env.AI`, the same pattern already used to debug this worker manually in this project. Each verification script is written to `/tmp` and deleted after use.

---

### Task 1: Stop treating a bare shared URL as caption text

**Files:**
- Modify: `worker/src/index.js:24-31` (add helper near `decodeEntities`)
- Modify: `worker/src/index.js:124-138` (use the helper in the main handler)
- Test: ad-hoc Node script (no test framework in this repo)

When Android shares an Instagram link, `expo-share-intent` often puts the bare URL itself into `shareIntent.text` (with no real caption). The worker currently does `if (text && text.trim()) parts.push(text.trim())`, so that bare URL becomes the entire LLM input — producing a blank recipe instead of the correct `needs_caption` fallback.

- [ ] **Step 1: Write the failing verification script**

```bash
cat > /tmp/test-task1.mjs << 'EOF'
// Simulates: Instagram blocks the OG fetch (no usable meta tags) AND the only
// "text" expo-share-intent gave us is the bare shared URL itself.
globalThis.fetch = async () => new Response('<html><head></head><body>login wall</body></html>', { status: 200 });

const worker = (await import('/home/burakkp/Documents/Projects/RecipeNest/worker/src/index.js')).default;

const env = {
  MODEL: 'test-model',
  AI: { run: async () => ({ response: { title: '', area: '', category: '', ingredients: [], steps: [] } }) },
};

const res = await worker.fetch(
  new Request('http://x/', {
    method: 'POST',
    body: JSON.stringify({
      url: 'https://www.instagram.com/p/abc123/',
      text: 'https://www.instagram.com/p/abc123/',
    }),
  }),
  env
);

console.log('status:', res.status);
console.log('body:', await res.json());
EOF
node /tmp/test-task1.mjs
```

Expected (current, buggy behavior): `status: 200` with a blank `title`/`ingredients`/`steps` — this reproduces the exact bug reported ("no recipe, no details, no recipe title").

- [ ] **Step 2: Confirm it fails (reproduces the bug) before fixing**

Run the command above. Expected output:
```
status: 200
body: { title: '', area: '', category: '', ingredients: [], steps: [], image: null, sourceUrl: 'https://www.instagram.com/p/abc123/' }
```
This confirms the bug: a 200 with an empty recipe, instead of the correct 422 `no_text`.

- [ ] **Step 3: Add the `isBareUrl` helper**

In `worker/src/index.js`, right after the `decodeEntities` function (before `getMetaContent`), add:

```javascript
// True when the shared "text" is nothing but a URL — i.e. not real caption
// content, even though it's non-empty. Common when sharing a bare link.
function isBareUrl(str) {
  return /^https?:\/\/\S+$/i.test(str.trim());
}
```

- [ ] **Step 4: Use the helper in the main handler**

In `worker/src/index.js`, find this line inside the `fetch` handler:

```javascript
    if (text && text.trim()) parts.push(text.trim());
```

Replace it with:

```javascript
    if (text && text.trim() && !isBareUrl(text)) parts.push(text.trim());
```

- [ ] **Step 5: Re-run the verification script and confirm the fix**

Run: `node /tmp/test-task1.mjs`

Expected output now:
```
status: 422
body: { error: 'no_text', image: null, sourceUrl: 'https://www.instagram.com/p/abc123/' }
```

- [ ] **Step 6: Clean up and commit**

```bash
rm /tmp/test-task1.mjs
git add worker/src/index.js
git commit -m "fix: don't treat a bare shared URL as recipe caption text"
```

---

### Task 2: Require a real description before trusting Open Graph text

**Files:**
- Modify: `worker/src/index.js:129-135` (the `if (url) { ... }` block in the main handler)
- Test: ad-hoc Node script

Instagram's login-wall/blocked page still has *some* `og:title` (e.g. just "Instagram"), but never a real `og:description`. Right now the worker pushes `og.title` into `parts` even when `og.description` is missing, which can produce non-empty-but-meaningless source text and the same blank-recipe symptom as Task 1, just via the URL-fetch path instead of the shared-text path.

- [ ] **Step 1: Write the failing verification script**

```bash
cat > /tmp/test-task2.mjs << 'EOF'
// Simulates Instagram's login-wall page: it has an og:title but no og:description.
const blockedHtml = '<html><head><meta property="og:title" content="Instagram" /></head><body></body></html>';
globalThis.fetch = async () => new Response(blockedHtml, { status: 200 });

const worker = (await import('/home/burakkp/Documents/Projects/RecipeNest/worker/src/index.js')).default;

const env = {
  MODEL: 'test-model',
  AI: { run: async () => ({ response: { title: '', area: '', category: '', ingredients: [], steps: [] } }) },
};

const res = await worker.fetch(
  new Request('http://x/', { method: 'POST', body: JSON.stringify({ url: 'https://www.instagram.com/p/abc123/' }) }),
  env
);

console.log('status:', res.status);
console.log('body:', await res.json());
EOF
node /tmp/test-task2.mjs
```

- [ ] **Step 2: Confirm it fails (reproduces the bug) before fixing**

Expected (buggy) output:
```
status: 200
body: { title: '', ... , image: null, sourceUrl: 'https://www.instagram.com/p/abc123/' }
```
A 200 with a blank recipe, even though nothing real was ever extracted — should be 422.

- [ ] **Step 3: Require `og.description` before pushing OG text**

In `worker/src/index.js`, find this block in the `fetch` handler:

```javascript
    if (url) {
      const og = await resolveUrl(url);
      image = og.image;
      if (og.title) parts.push(og.title);
      if (og.description) parts.push(og.description);
    }
```

Replace it with:

```javascript
    if (url) {
      const og = await resolveUrl(url);
      image = og.image;
      // A real public post always has a description (the caption). A bare
      // title with no description is what Instagram's blocked/login-wall
      // pages return — don't treat that as real content.
      if (og.description) {
        if (og.title) parts.push(og.title);
        parts.push(og.description);
      }
    }
```

- [ ] **Step 4: Re-run the verification script and confirm the fix**

Run: `node /tmp/test-task2.mjs`

Expected output now:
```
status: 422
body: { error: 'no_text', image: null, sourceUrl: 'https://www.instagram.com/p/abc123/' }
```

- [ ] **Step 5: Confirm a real post (with description) still works**

```bash
cat > /tmp/test-task2b.mjs << 'EOF'
const realHtml = `<html><head>
<meta property="og:title" content="Jane Doe (@janedoe) on Instagram" />
<meta property="og:description" content="Spicy arrabiata penne: pasta, tomatoes, garlic, chili flakes, basil. Boil pasta. Fry garlic, add tomatoes, simmer, toss with pasta and basil." />
</head><body></body></html>`;
globalThis.fetch = async () => new Response(realHtml, { status: 200 });

const worker = (await import('/home/burakkp/Documents/Projects/RecipeNest/worker/src/index.js')).default;
const env = {
  MODEL: 'test-model',
  AI: { run: async () => ({ response: { title: 'Spicy Arrabiata Penne', area: 'Italian', category: 'Pasta', ingredients: [{name:'pasta',measure:''}], steps: ['Boil pasta.'] } }) },
};
const res = await worker.fetch(new Request('http://x/', { method: 'POST', body: JSON.stringify({ url: 'https://www.instagram.com/p/real/' }) }), env);
console.log('status:', res.status);
console.log('body:', await res.json());
EOF
node /tmp/test-task2b.mjs
```

Expected output:
```
status: 200
body: { title: 'Spicy Arrabiata Penne', area: 'Italian', category: 'Pasta', ingredients: [ { name: 'pasta', measure: '' } ], steps: [ 'Boil pasta.' ], image: null, sourceUrl: 'https://www.instagram.com/p/real/' }
```

- [ ] **Step 6: Clean up and commit**

```bash
rm /tmp/test-task2.mjs /tmp/test-task2b.mjs
git add worker/src/index.js
git commit -m "fix: require a real description before trusting Open Graph text as recipe source"
```

---

### Task 3: Extract video URL and account handle from Open Graph tags

**Files:**
- Modify: `worker/src/index.js:46-63` (`resolveUrl` function)
- Test: ad-hoc Node script

- [ ] **Step 1: Write the verification script for the new fields**

`resolveUrl` isn't exported from the module (it's only used internally), so verify it indirectly through the full `fetch` handler, the same way every other test in this plan does:

```bash
cat > /tmp/test-task3.mjs << 'EOF'
const html = `<html><head>
<meta property="og:title" content="Jane Doe (@janedoe) on Instagram" />
<meta property="og:description" content="A great recipe." />
<meta property="og:image" content="https://example.com/thumb.jpg" />
<meta property="og:video:secure_url" content="https://example.com/clip.mp4" />
</head><body></body></html>`;
globalThis.fetch = async () => new Response(html, { status: 200 });

const worker = (await import('/home/burakkp/Documents/Projects/RecipeNest/worker/src/index.js')).default;
const env = {
  MODEL: 'test-model',
  AI: { run: async () => ({ response: { title: 'Recipe', area: '', category: '', ingredients: [], steps: [] } }) },
};
const res = await worker.fetch(new Request('http://x/', { method: 'POST', body: JSON.stringify({ url: 'https://www.instagram.com/p/abc/' }) }), env);
console.log(await res.json());
EOF
node /tmp/test-task3.mjs
```

- [ ] **Step 2: Confirm it fails (no `video`/`handle` in the response yet)**

Expected (current) output — note there's no `video` or `handle` field at all:
```
{ title: 'Recipe', area: '', category: '', ingredients: [], steps: [], image: 'https://example.com/thumb.jpg', sourceUrl: 'https://www.instagram.com/p/abc/' }
```

- [ ] **Step 3: Update `resolveUrl` to extract video and handle**

In `worker/src/index.js`, replace the whole `resolveUrl` function with:

```javascript
async function resolveUrl(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      },
    });
    const html = await res.text();
    const title = getMetaContent(html, 'og:title');
    // Instagram's og:title is typically "<Name> (@<handle>) on Instagram" —
    // pull the handle out so we can always credit/link the original account.
    const handleMatch = title ? title.match(/\(@([a-zA-Z0-9_.]+)\)/) : null;
    return {
      image: getMetaContent(html, 'og:image'),
      video: getMetaContent(html, 'og:video:secure_url') || getMetaContent(html, 'og:video'),
      title,
      description: getMetaContent(html, 'og:description'),
      handle: handleMatch ? handleMatch[1] : null,
    };
  } catch (e) {
    return { image: null, video: null, title: null, description: null, handle: null };
  }
}
```

- [ ] **Step 4: Wire the new fields through the main handler**

In `worker/src/index.js`, find:

```javascript
    const { url, text } = body || {};
    const sourceUrl = url || '';
    let image = null;
    const parts = [];

    if (url) {
      const og = await resolveUrl(url);
      image = og.image;
      // A real public post always has a description (the caption). A bare
      // title with no description is what Instagram's blocked/login-wall
      // pages return — don't treat that as real content.
      if (og.description) {
        if (og.title) parts.push(og.title);
        parts.push(og.description);
      }
    }

    if (text && text.trim() && !isBareUrl(text)) parts.push(text.trim());

    const source = parts.join('\n\n').trim();

    if (!source) {
      return json({ error: 'no_text', image, sourceUrl }, 422);
    }

    const raw = await callLLM(env, source);
    const recipe =
      parseRecipeJSON(raw) || { title: '', area: '', category: '', ingredients: [], steps: [] };

    return json({ ...recipe, image, sourceUrl });
```

Replace it with:

```javascript
    const { url, text } = body || {};
    const sourceUrl = url || '';
    let image = null;
    let video = null;
    let handle = null;
    const parts = [];

    if (url) {
      const og = await resolveUrl(url);
      image = og.image;
      video = og.video;
      handle = og.handle;
      // A real public post always has a description (the caption). A bare
      // title with no description is what Instagram's blocked/login-wall
      // pages return — don't treat that as real content.
      if (og.description) {
        if (og.title) parts.push(og.title);
        parts.push(og.description);
      }
    }

    if (text && text.trim() && !isBareUrl(text)) parts.push(text.trim());

    const source = parts.join('\n\n').trim();

    if (!source) {
      return json({ error: 'no_text', image, video, handle, sourceUrl }, 422);
    }

    const raw = await callLLM(env, source);
    const recipe =
      parseRecipeJSON(raw) || { title: '', area: '', category: '', ingredients: [], steps: [] };

    return json({ ...recipe, image, video, handle, sourceUrl });
```

- [ ] **Step 5: Re-run the verification script and confirm the fix**

Run: `node /tmp/test-task3.mjs`

Expected output now:
```
{
  title: 'Recipe', area: '', category: '', ingredients: [], steps: [],
  image: 'https://example.com/thumb.jpg',
  video: 'https://example.com/clip.mp4',
  handle: 'janedoe',
  sourceUrl: 'https://www.instagram.com/p/abc/'
}
```

- [ ] **Step 6: Clean up and commit**

```bash
rm /tmp/test-task3.mjs
git add worker/src/index.js
git commit -m "feat: extract og:video and account handle from shared posts"
```

---

### Task 4: Deploy the worker and confirm live behavior

**Files:** none (deploy step only)

- [ ] **Step 1: Push the committed changes**

```bash
git push
```

(This triggers the Git-connected Cloudflare Workers Build pipeline already set up for this project.)

- [ ] **Step 2: Confirm the deploy succeeded**

Check the Cloudflare dashboard's deployment log for `recipe-nest`, or ask whoever has access to confirm "Success".

- [ ] **Step 3: Verify the blocked-post case now correctly falls back**

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST https://recipe-nest.burak-kucukparmaksiz.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.instagram.com/p/some-real-post/","text":"https://www.instagram.com/p/some-real-post/"}' \
  --max-time 30
```

Expected: `HTTP 422` with `{"error":"no_text", ...}` if Instagram blocks the fetch (most likely), or a populated recipe with `video`/`handle` fields if the post happened to be fully public and accessible.

- [ ] **Step 4: Verify a real caption still extracts correctly**

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST https://recipe-nest.burak-kucukparmaksiz.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{"text":"Spicy arrabiata penne: pasta, tomatoes, garlic, chili flakes, basil. Boil pasta. Fry garlic in olive oil, add tomatoes and chili flakes, simmer 10 min, toss with pasta and basil."}' \
  --max-time 30
```

Expected: `HTTP 200` with a fully populated `title`/`ingredients`/`steps`.

---

### Task 5: Surface video/handle through the app's extract API

**Files:**
- Modify: `src/api/extract.js` (whole file)

- [ ] **Step 1: Update `extractRecipe` to attach the new fields on the `needs_caption` error too**

Replace the full contents of `src/api/extract.js` with:

```javascript
// Migration seam: point this at a new host and the app's extraction call moves with it.
export const EXTRACT_ENDPOINT = 'https://recipe-nest.burak-kucukparmaksiz.workers.dev';

export async function extractRecipe({ url, text }) {
  const res = await fetch(EXTRACT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, text }),
  });

  const data = await res.json();

  if (res.status === 422) {
    const error = new Error(data.error || 'no_text');
    error.code = 'NEEDS_CAPTION';
    error.image = data.image;
    error.video = data.video;
    error.handle = data.handle;
    error.sourceUrl = data.sourceUrl;
    throw error;
  }

  if (!res.ok) {
    throw new Error(data.error || 'extract_failed');
  }

  return data;
}
```

- [ ] **Step 2: Verify by reading the diff**

Run: `git diff src/api/extract.js`

Expected: only the `EXTRACT_ENDPOINT` value (already correct from prior work) plus the two new `error.video`/`error.handle` lines are different from the prior version. No test framework exists for this file (it's a thin fetch wrapper); the real verification happens end-to-end in Task 8.

- [ ] **Step 3: Commit**

```bash
git add src/api/extract.js
git commit -m "feat: surface video/handle fields from the extract API"
```

---

### Task 6: Carry video/handle through the import draft and always show the original post

**Files:**
- Modify: `src/screens/ShareImportScreen.js`

- [ ] **Step 1: Store the new fields on the draft and caption-fallback state**

In `src/screens/ShareImportScreen.js`, find the `runExtract` callback:

```javascript
  const runExtract = useCallback((payload) => {
    setStatus('loading');
    extractRecipe(payload)
      .then((data) => {
        setDraft({
          title: data.title || '',
          image: data.image || '',
          area: data.area || '',
          category: data.category || '',
          ingredients: data.ingredients || [],
          steps: data.steps || [],
          sourceUrl: data.sourceUrl || payload.url || '',
        });
        setStatus('ready');
      })
      .catch((err) => {
        if (err.code === 'NEEDS_CAPTION') {
          setCaptionInfo({ image: err.image, sourceUrl: err.sourceUrl });
          setStatus('needs_caption');
        } else {
          setStatus('error');
        }
      });
  }, []);
```

Replace it with:

```javascript
  const runExtract = useCallback((payload) => {
    setStatus('loading');
    extractRecipe(payload)
      .then((data) => {
        setDraft({
          title: data.title || '',
          image: data.image || '',
          video: data.video || '',
          handle: data.handle || '',
          area: data.area || '',
          category: data.category || '',
          ingredients: data.ingredients || [],
          steps: data.steps || [],
          sourceUrl: data.sourceUrl || payload.url || '',
        });
        setStatus('ready');
      })
      .catch((err) => {
        if (err.code === 'NEEDS_CAPTION') {
          setCaptionInfo({
            image: err.image,
            video: err.video,
            handle: err.handle,
            sourceUrl: err.sourceUrl,
          });
          setStatus('needs_caption');
        } else {
          setStatus('error');
        }
      });
  }, []);
```

- [ ] **Step 2: Carry the fields into the saved recipe**

Find `handleSave`:

```javascript
  function handleSave() {
    const recipe = {
      id: `imported-${Date.now()}`,
      title: draft.title,
      thumb: draft.image,
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

Replace it with:

```javascript
  function handleSave() {
    const recipe = {
      id: `imported-${Date.now()}`,
      title: draft.title,
      thumb: draft.image,
      video: draft.video,
      handle: draft.handle,
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

- [ ] **Step 3: Always show a link to the original post in the `needs_caption` state**

Find this block in the `needs_caption` render branch:

```javascript
        {captionInfo?.image ? (
          <Image source={{ uri: captionInfo.image }} style={styles.previewImage} />
        ) : null}
        <Text style={styles.heading}>We couldn't read a recipe from that link</Text>
        <Text style={styles.muted}>
          Paste the caption or recipe text below and we'll structure it for you.
        </Text>
```

Replace it with:

```javascript
        {captionInfo?.image ? (
          <Image source={{ uri: captionInfo.image }} style={styles.previewImage} />
        ) : null}
        <Text style={styles.heading}>We couldn't read a recipe from that link</Text>
        <Text style={styles.muted}>
          Paste the caption or recipe text below and we'll structure it for you.
        </Text>
        {!!captionInfo?.sourceUrl && (
          <TouchableOpacity onPress={() => Linking.openURL(captionInfo.sourceUrl)}>
            <Text style={styles.sourceLink}>
              {captionInfo.handle ? `View @${captionInfo.handle}'s post` : 'View original post'}
            </Text>
          </TouchableOpacity>
        )}
```

- [ ] **Step 4: Always show the same link in the `ready` (editable draft) state**

Find this block in the `ready` render branch:

```javascript
      {draft.image ? <Image source={{ uri: draft.image }} style={styles.previewImage} /> : null}

      <Text style={styles.label}>Title</Text>
```

Replace it with:

```javascript
      {draft.image ? <Image source={{ uri: draft.image }} style={styles.previewImage} /> : null}

      {!!draft.sourceUrl && (
        <TouchableOpacity onPress={() => Linking.openURL(draft.sourceUrl)}>
          <Text style={styles.sourceLink}>
            {draft.handle ? `View @${draft.handle}'s post` : 'View original post'}
          </Text>
        </TouchableOpacity>
      )}
      {!!draft.video && (
        <TouchableOpacity onPress={() => Linking.openURL(draft.video)}>
          <Text style={styles.sourceLink}>Watch original video</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.label}>Title</Text>
```

- [ ] **Step 5: Add the `Linking` import**

At the top of `src/screens/ShareImportScreen.js`, find:

```javascript
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
```

Replace it with:

```javascript
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
```

- [ ] **Step 6: Add a `sourceLink` style**

Find the `previewImage` style block:

```javascript
  previewImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.chip,
    marginBottom: 16,
  },
```

Add a new style right after it:

```javascript
  previewImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.chip,
    marginBottom: 16,
  },
  sourceLink: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
```

- [ ] **Step 7: Verify by bundling**

```bash
npx expo export --platform android --output-dir /tmp/verify-task6 2>&1 | tail -10
rm -rf /tmp/verify-task6
```

Expected: `Android Bundled` with no errors (this catches typos/syntax errors and missing imports — there's no component test runner in this project).

- [ ] **Step 8: Commit**

```bash
git add src/screens/ShareImportScreen.js
git commit -m "feat: always show a link to the original post during import"
```

---

### Task 7: Always show the original post (and video) on the Detail screen

**Files:**
- Modify: `src/screens/DetailScreen.js`

- [ ] **Step 1: Show the account handle next to the title when present**

Find this block:

```javascript
        <View style={styles.body}>
          <Text style={styles.title}>{recipe.title}</Text>

          {(recipe.category || recipe.area) && (
```

Replace it with:

```javascript
        <View style={styles.body}>
          <Text style={styles.title}>{recipe.title}</Text>
          {!!recipe.handle && <Text style={styles.handle}>@{recipe.handle}</Text>}

          {(recipe.category || recipe.area) && (
```

- [ ] **Step 2: Add a `handle` style**

Find the `title` style:

```javascript
  title: {
    ...type.display,
    color: colors.ink,
    marginBottom: 12,
  },
```

Add right after it:

```javascript
  title: {
    ...type.display,
    color: colors.ink,
    marginBottom: 12,
  },
  handle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
```

- [ ] **Step 3: Always show the original-post link, and add a video link**

Find:

```javascript
        {recipe.source ? (
          <Pressable onPress={() => Linking.openURL(recipe.source)}>
            <Text style={styles.sourceLink}>View source</Text>
          </Pressable>
        ) : null}
```

Replace it with:

```javascript
        {recipe.source ? (
          <Pressable onPress={() => Linking.openURL(recipe.source)}>
            <Text style={styles.sourceLink}>
              {recipe.handle ? `View @${recipe.handle}'s post` : 'View original post'}
            </Text>
          </Pressable>
        ) : null}
        {recipe.video ? (
          <Pressable onPress={() => Linking.openURL(recipe.video)}>
            <Text style={styles.sourceLink}>Watch original video</Text>
          </Pressable>
        ) : null}
```

- [ ] **Step 4: Verify by bundling**

```bash
npx expo export --platform android --output-dir /tmp/verify-task7 2>&1 | tail -10
rm -rf /tmp/verify-task7
```

Expected: `Android Bundled` with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/screens/DetailScreen.js
git commit -m "feat: always show the original post link (and video link) on Detail"
```

---

### Task 8: Full end-to-end manual verification

**Files:** none (manual device test)

- [ ] **Step 1: Rebuild the release APK**

```bash
cd android
export ANDROID_HOME=/home/burakkp/Android/Sdk ANDROID_SDK_ROOT=/home/burakkp/Android/Sdk
./gradlew assembleRelease
```

Expected: `BUILD SUCCESSFUL`. APK at `android/app/build/outputs/apk/release/app-release.apk`.

- [ ] **Step 2: Install on the physical device**

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

- [ ] **Step 3: Test the blocked-post path**

Share a real Instagram post/reel link into Plated. Expected: since Instagram almost always blocks the worker's fetch, you should land on the **paste-the-caption** screen — now with a "View @handle's post" (or "View original post") link visible above the paste box, instead of silently producing a blank "recipe found" card.

- [ ] **Step 4: Test the manual-paste path end to end**

On that same screen, copy the real caption text from the Instagram app and paste it in, then tap "Extract recipe". Expected: a populated "Recipe found" card with real title/ingredients/steps, plus the "View @handle's post" link still visible.

- [ ] **Step 5: Save and confirm Detail screen**

Tap "Save to my recipes". Expected: Detail screen shows the title, `@handle` under the title, ingredients/steps, and a "View @handle's post" link (plus "Watch original video" if that particular post exposed an `og:video` tag — many won't, since Instagram serves video through other mechanisms it doesn't expose via Open Graph when blocked).

- [ ] **Step 6: Re-test a plain caption paste (no link) still works**

From the Feed, this path isn't directly reachable from the UI, but confirm via curl (already covered in Task 4, Step 4) that text-only extraction with no `url` still works — this guards against a regression where requiring `og.description` accidentally also blocked the no-URL case (it can't, since that branch is gated on `if (url)`, but re-confirming here closes the loop).
