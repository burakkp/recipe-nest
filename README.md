# RecipeNest

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

The vision model (`llama-3.2-11b-vision-instruct`) is gated behind Meta's Llama Community
License — **on a fresh Cloudflare account, the first image request will fail with error
5016** until you accept it once. Fix: send one request with `{"prompt": "agree"}` to that
model (e.g. via the [Workers AI Playground](https://playground.ai.cloudflare.com/?model=%40cf%2Fmeta%2Fllama-3.2-11b-vision-instruct),
or `curl https://api.cloudflare.com/client/v4/accounts/<account_id>/ai/run/@cf/meta/llama-3.2-11b-vision-instruct -H "Authorization: Bearer <token>" -d '{"prompt":"agree"}'`).
The license also includes an EU-domicile exclusion clause — read it before accepting.

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
| Vision LLM        | Workers AI — Llama 3.2 11B Vision (free, gated\*) | Swap the model in `callVisionLLM` in `worker/src/index.js` |

\* Requires a one-time license acceptance — see "Run the worker" above.

## Honest limits

- **No Expo Go.** Sharing into the app needs a custom dev client (`eas build --profile development`).
- **Llama < Claude.** The free model occasionally mis-structures ingredients/steps — that's
  why the import screen is editable before saving, not auto-saved.
- **Image extraction quality depends on what's visible.** Works for Story photos with
  on-image recipe text, and for screenshots of a post's caption panel — the vision model
  reads dense paragraph text reasonably well, including non-English text (it's auto-
  translated to English). But it only sees what's in the frame: a caption cut off below the
  screenshot's crop, or a dish with no text at all, will under-deliver or fill gaps with
  plausible-but-unverified guesses. Always review the editable draft before saving.
- **Workers AI free tier caps at ~10,000 neuron-inferences/day.** Image extraction costs two
  inferences (vision model + text model) instead of one. Fine for personal use and demos;
  will need a paid plan or a different model under heavier use.

## Out of scope (for now)

Auth, cloud sync, Reels audio transcription, user-generated posts, likes/comments.
