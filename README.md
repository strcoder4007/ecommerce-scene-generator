# Ecommerce Scene Generator (Starter)

This repo includes:
- `frontend/`: Vue 3 (Vite) dashboard that runs 100% client-side (static HTML/CSS/JS build).
- `backend/`: legacy FastAPI backend (no longer required for the GitHub Pages / static deployment flow).

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` and paste your **Gemini API key** in the UI (BYO key). The key is stored locally in your browser (`localStorage`).

## Build static files (GitHub Pages)

```bash
npm run build
```

Output: `frontend/dist/` (deploy these files).

For GitHub Pages, make sure Vite’s base path matches your repo name. One option:

```bash
npm run build -- --base=/YOUR_REPO_NAME/
```

## Notes

- All generation happens in the browser via direct calls to the Gemini API using the key you provide.
- The **Assets** tab stores backgrounds/models locally in your browser (IndexedDB). Nothing is uploaded to a server.
- If you want to avoid client-side keys entirely, use a backend/serverless proxy instead of GitHub Pages (not covered in this static-only setup).
