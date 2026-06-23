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
  },
};
