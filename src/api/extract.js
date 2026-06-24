// Migration seam: point this at a new host and the app's extraction call moves with it.
export const EXTRACT_ENDPOINT = 'https://recipe-nest.burak-kucukparmaksiz.workers.dev';

export async function extractRecipe({ url, text, image }) {
  let res;
  if (image) {
    // Instagram Story share: no caption/link, just an image — send it as
    // multipart so the worker can run it through a vision model. Don't set
    // Content-Type manually; fetch needs to add its own multipart boundary.
    const formData = new FormData();
    formData.append('image', {
      uri: image.path,
      name: image.fileName || 'story.jpg',
      type: image.mimeType || 'image/jpeg',
    });
    res = await fetch(EXTRACT_ENDPOINT, { method: 'POST', body: formData });
  } else {
    res = await fetch(EXTRACT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, text }),
    });
  }

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
