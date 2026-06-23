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
