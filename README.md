# Ecommerce Scene Generator (Starter)

This starter includes:
- `backend/`: FastAPI API with a `/api/virtual-try-on` endpoint that calls the Gemini image API (“Nano Banana”).
- `frontend/`: React dashboard to upload a person photo + garment photo and display the generated try-on image.

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
- The dashboard posts `multipart/form-data` with `user_photo` and `garment_photo` to the backend.
- If the Gemini API rejects `imageConfig`, keep `GEMINI_USE_IMAGE_CONFIG=0` (default).
- If you see `ModuleNotFoundError`, make sure your venv is active and start with `python -m uvicorn ...` (so it uses the same interpreter you installed deps into).

## Optional: test the API with curl

```bash
curl -sS -X POST "http://localhost:8000/api/virtual-try-on" \
  -F "user_photo=@/path/to/person.jpg" \
  -F "garment_photo=@/path/to/garment.jpg" \
  | jq .
```
