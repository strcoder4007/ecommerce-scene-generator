# Ecommerce Scene Generator (Frontend + Backend)

Vue 3 frontend with an Express backend that calls Gemini and stores generated images in Azure Blob Storage.

## Local development

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
npm --prefix server install
cp server/.env.example server/.env
npm run dev:server
```

Open `http://localhost:5173`. The frontend proxies `/api` to `http://localhost:3001` in dev.

## Environment variables (backend)

Set these in `server/.env` (and in Azure App Service):

- `GEMINI_API_KEY`: your Gemini API key.
- `AZURE_STORAGE_CONNECTION_STRING`: connection string for the storage account.
- `AZURE_STORAGE_CONTAINER`: container name (default: `images`).
- `CORS_ORIGIN`: comma-separated list of allowed origins (leave empty to allow all).

## Azure deployment

Backend (App Service):

- Deploy the `server/` directory.
- Set `PORT`, `GEMINI_API_KEY`, `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER`, and `CORS_ORIGIN` in App Settings.
- Ensure the Blob container has public read access (level "blob").

Frontend (Azure Static Web Apps or App Service static hosting):

- Build output is `dist/`.
- Set `VITE_API_BASE_URL` to your backend URL.

## Storyboards

- Storyboards and settings are stored in the browser using `localStorage`.
- Create, rename, duplicate, and delete storyboards from the UI.
