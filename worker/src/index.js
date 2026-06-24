const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

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

// Prompt for the vision model: turn an image (e.g. a screenshot of an Instagram
// post/Story caption panel, or a Story photo with the recipe written as on-image
// text stickers) into plain text the same SYSTEM_PROMPT pipeline above can structure.
const VISION_PROMPT = `Transcribe every piece of text visible in this image exactly as
written, in its original language — including any title, caption, ingredient list with
quantities, and numbered or bulleted steps. Read carefully line by line; do not skip or
summarize any text, even if it is a long paragraph. If the image is a photo of a finished
dish with little or no text, instead describe the dish and any visible ingredients in
detail. Output plain text only, in the original language (do not translate here).`;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// True when the shared "text" is nothing but a URL — i.e. not real caption
// content, even though it's non-empty. Common when sharing a bare link.
function isBareUrl(str) {
  return /^https?:\/\/\S+$/i.test(str.trim());
}

// Matches <meta property="og:x" content="..."> in either attribute order.
function getMetaContent(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]*(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, 'i'),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match) return decodeEntities(match[1]);
  }
  return null;
}

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

// Some Workers AI models return the parsed object directly under `.response`;
// others return a raw string (possibly with markdown/commentary around the JSON).
function parseRecipeJSON(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

// The free 8B model sometimes drifts from the requested shape (e.g. emitting
// {"action": "..."} instead of a plain step string) — coerce back to the
// app's expected shape rather than letting the screen render raw objects.
function coerceToString(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const candidate = value.step ?? value.action ?? value.text ?? value.instruction ?? value.description;
    if (typeof candidate === 'string') return candidate;
  }
  return value == null ? '' : String(value);
}

function normalizeRecipe(recipe) {
  return {
    title: typeof recipe.title === 'string' ? recipe.title : '',
    area: typeof recipe.area === 'string' ? recipe.area : '',
    category: typeof recipe.category === 'string' ? recipe.category : '',
    description: typeof recipe.description === 'string' ? recipe.description : '',
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map((ing) =>
          ing && typeof ing === 'object'
            ? { name: coerceToString(ing.name), measure: coerceToString(ing.measure) }
            : { name: coerceToString(ing), measure: '' }
        )
      : [],
    steps: Array.isArray(recipe.steps) ? recipe.steps.map(coerceToString) : [],
  };
}

// Turns image bytes into plain text (a transcription/description) so the same
// text-based callLLM below can structure it into a recipe. Swap point for a
// different vision model/provider — keep the signature (env, bytes) -> string.
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

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405);
    }

    const contentType = request.headers.get('content-type') || '';
    const parts = [];
    let sourceUrl = '';
    let image = null;
    let video = null;
    let handle = null;

    if (contentType.includes('multipart/form-data')) {
      // A shared Instagram Story: no caption, no public post link — just an
      // image, often with the recipe written as on-image text stickers (Stories
      // have no caption field at all). Run it through the vision model first.
      let formData;
      try {
        formData = await request.formData();
      } catch (e) {
        return json({ error: 'invalid_form_data' }, 400);
      }
      const file = formData.get('image');
      if (file && typeof file !== 'string') {
        const bytes = [...new Uint8Array(await file.arrayBuffer())];
        const description = await callVisionLLM(env, bytes);
        if (description.trim()) parts.push(description.trim());
      }
    } else {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: 'invalid_json' }, 400);
      }

      const { url, text } = body || {};
      sourceUrl = url || '';

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
    }

    const source = parts.join('\n\n').trim();

    if (!source) {
      return json({ error: 'no_text', image, video, handle, sourceUrl }, 422);
    }

    const raw = await callLLM(env, source);
    const recipe = normalizeRecipe(
      parseRecipeJSON(raw) || { title: '', area: '', category: '', ingredients: [], steps: [] }
    );

    return json({ ...recipe, image, video, handle, sourceUrl });
  },
};
