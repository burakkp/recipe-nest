# Plated

An Instagram-style recipe app. Browse a recipe feed, search, save favorites, and import a
recipe straight from a shared link, caption, or Story image — a Cloudflare Worker resolves
the link (or reads the image) and an LLM structures it into ingredients and steps.

## Run the app

Share targets require a **custom dev client** — this does not work in Expo Go.

```bash
npm install
npx eas build --profile development --platform ios   # or --platform android
npx expo start --dev-client
```

Install the resulting build on your device/simulator, then open it from `expo start --dev-client`.

## Run the worker

```bash
cd worker
npm install
npx wrangler login
npx wrangler deploy
```

Copy the deployed `*.workers.dev` URL into `EXTRACT_ENDPOINT` in
[src/api/extract.js](src/api/extract.js).

Test it directly:

```bash
curl -X POST <your-worker-url> -d '{"text":"Spicy arrabiata penne: pasta, tomatoes, garlic, chili flakes. Boil pasta, fry garlic, add tomatoes, toss."}'
```

Test the Story/image path (a photo with the recipe written as on-image text, or just a food photo):

```bash
curl -X POST <your-worker-url> -F "image=@/path/to/story.jpg"
```

## Free stack

| Layer            | Provider                          | Migration target                                    |
| ----------------- | ---------------------------------- | ---------------------------------------------------- |
| Recipe data       | TheMealDB (free, no key)           | Swap `src/api/mealdb.js` for another provider        |
| Local storage     | AsyncStorage                       | Swap `src/context/SavedContext.js` for cloud sync    |
| Extraction host   | Cloudflare Worker (free tier)      | Change `EXTRACT_ENDPOINT` in `src/api/extract.js`    |
| LLM               | Workers AI — Llama 3.1 8B (free)   | Swap the body of `callLLM` in `worker/src/index.js` (commented Claude stub included) |
| Vision LLM        | Workers AI — LLaVA 1.5 7B (free)   | Swap the model in `callVisionLLM` in `worker/src/index.js` |

## Honest limits

- **No Expo Go.** Sharing into the app needs a custom dev client (`eas build --profile development`).
- **Llama < Claude.** The free model occasionally mis-structures ingredients/steps — that's
  why the import screen is editable before saving, not auto-saved.
- **Stories have no caption, so quality depends on the image.** Instagram Stories don't
  expose a public link or caption at all — only the shared image. If the recipe is written
  as on-image text (a common Story format) extraction is usually solid; a plain food photo
  with no text gives the vision model much less to work with, so expect a rougher result.
- **Workers AI free tier caps at ~10,000 neuron-inferences/day.** Image extraction costs two
  inferences (vision model + text model) instead of one. Fine for personal use and demos;
  will need a paid plan or a different model under heavier use.

## Out of scope (for now)

Auth, cloud sync, Reels audio transcription, user-generated posts, likes/comments.
