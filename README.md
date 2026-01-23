# Ecommerce Scene Generator (Client-Side)

Vue 3 app that runs fully in the browser and calls Gemini directly with a user-provided API key. Generated images can be saved locally in IndexedDB.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## API key

Use the **API Key** tab in the sidebar to paste your Gemini API key. The key is stored locally in `localStorage` and used for all generation requests.

## Storage

- Storyboards and settings are stored in `localStorage`.
- Saved images are stored in `IndexedDB` (use **Save** / **Save all images** in the results panel).

## Notes

- This is a client-only architecture; no backend is required for generation or storage.
- The `server/` folder remains for reference, but the current UI does not call it.
