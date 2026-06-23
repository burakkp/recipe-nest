const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SYSTEM_PROMPT = `You convert a messy food caption into structured recipe JSON.
Return ONLY valid JSON, no markdown, no commentary, in this exact shape:
{"title": "", "area": "", "category": "", "ingredients": [{"name": "", "measure": ""}], "steps": []}
Rules:
- Fill in only what you can confidently infer from the text.
- Leave unknown string fields as empty strings, unknown lists as empty arrays.
- "area" is a cuisine/region (e.g. "Italian"), "category" is a meal type (e.g. "Dessert").
- "steps" is an ordered array of short instruction strings.
- If the text is not a recipe at all, return title/ingredients/steps empty.`;

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
    return {
      image: getMetaContent(html, 'og:image'),
      title: getMetaContent(html, 'og:title'),
      description: getMetaContent(html, 'og:description'),
    };
  } catch (e) {
    return { image: null, title: null, description: null };
  }
}

function parseRecipeJSON(raw) {
  if (!raw) return null;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch (e) {
    return null;
  }
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

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'invalid_json' }, 400);
    }

    const { url, text } = body || {};
    const sourceUrl = url || '';
    let image = null;
    const parts = [];

    try {
      if (url) {
        const og = await resolveUrl(url);
        image = og.image;
        if (og.title) parts.push(og.title);
        if (og.description) parts.push(og.description);
      }

      if (text && text.trim()) parts.push(text.trim());

      const source = parts.join('\n\n').trim();

      if (!source) {
        return json({ error: 'no_text', image, sourceUrl }, 422);
      }

      const raw = await callLLM(env, source);

      // Temporary debug surface to find the root cause — remove once fixed.
      return json({ error: 'debug_raw_shape', rawType: typeof raw, raw }, 200);

      const parsed = parseRecipeJSON(raw);
      const recipe = parsed || { title: '', area: '', category: '', ingredients: [], steps: [] };

      if (!parsed) {
        return json({ error: 'debug_parse_failed', raw, ...recipe, image, sourceUrl }, 200);
      }

      return json({ ...recipe, image, sourceUrl });
    } catch (err) {
      // Temporary debug surface to find the root cause — remove once fixed.
      return json({ error: 'debug_exception', message: String(err && err.message), stack: String(err && err.stack) }, 500);
    }
  },
};
