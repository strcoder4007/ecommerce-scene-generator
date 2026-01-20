# Ecommerce Scene Generator (Client-Side)

A 100% client-side Vue 3 (Vite) app that generates photorealistic fashion ecommerce scenes using the Gemini API.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173/ecommerce-scene-generator/` (adjust if you change `base` in `vite.config.ts`), then paste your **Gemini API key** in the UI. The key is stored locally in your browser (`localStorage`).

## Storyboards (idea management)

- The app uses storyboards to store creative settings (occasion, background theme, accessories, etc.) in `localStorage`.
- Each storyboard stores its settings (occasion, background theme, accessories, etc.) in `localStorage`.
- Create / rename / duplicate / delete storyboards from the UI.

## Tabs

- **Prints (first tab):** upload a white garment photo + a print/design image (pattern or solid color swatch), optionally add a prompt, then click **Generate printed garment**.
- **Generate (second tab):** pick a storyboard and generate the final photorealistic ecommerce scene.

## Build & deploy (GitHub Pages)

```bash
npm run build
```

Static output is written to `docs/` (configured in `vite.config.ts`). For GitHub Pages, set the Pages source to `docs/` and ensure `base` in `vite.config.ts` matches your repo name (currently `/ecommerce-scene-generator/`).

## Notes / security

- This is **BYO key**: all Gemini calls happen from the browser using the key you provide.
- If you want to avoid exposing keys to clients, use a backend/serverless proxy instead of GitHub Pages.
