# Ecommerce Scene Generator (Starter)

This starter includes:
- `backend/`: FastAPI API with:
  - `/api/assets/*` for backgrounds/models
  - `/api/generate-look` for garment → model+background generation
  - `/api/virtual-try-on` (older person+garment try-on endpoint)
- `frontend/`: React dashboard to upload a garment image, optionally choose a model/background, and generate a photorealistic look.

## 1) Run the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and set GEMINI_API_KEY.
python -m uvicorn app.main:app --reload --port 8000
```

Backend health check: `GET http://localhost:8000/health`

## 2) Run the frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Notes
- You can generate without uploading assets; the system will invent a matching model + background from the garment photo.
- For more control/consistency, upload **background** and **model** assets in the dashboard’s **Assets** tab, then (optionally) select them in **Generate**.
- For best auto-picks, set `theme` on backgrounds (beach/party/forest/…) and `ethnicity` on models (Indian/Russian/…).
- The Generate flow posts `multipart/form-data` with `garment_photo` (and optional overrides) to `/api/generate-look`.
- If the Gemini API rejects `imageConfig`, keep `GEMINI_USE_IMAGE_CONFIG=0` (default).
- If you see `ModuleNotFoundError`, make sure your venv is active and start with `python -m uvicorn ...` (so it uses the same interpreter you installed deps into).

## Optional: test the API with curl

```bash
curl -sS -X POST "http://localhost:8000/api/generate-look" \
  -F "garment_photo=@/path/to/garment.jpg" \
  -F "occasion=beachwear" \
  -F "color_scheme=blue and white" \
  -F "print_style=floral" \
  | jq .
```
