# Ecommerce Scene Generator (AI Fashion Imagery) — Implementation Steps

This document is the build spec + step-by-step implementation plan for an automated fashion image generation pipeline that turns a base white-dress prototype photo into reviewable ecommerce-ready images by:
- generating prints/colors on the dress (“design generation”),
- recommending background + model assets (CLIP/VLM-assisted),
- generating final composites via an image generation model (Google Gemini / “Nano Banana Pro”),
- automatically QA-checking outputs (VLM + heuristics),
- generating additional angles (Zero123 or prompt-based fallback),
- keeping a human in the loop via a React dashboard (approve/reject/regenerate).

## 1) Scope and MVP definition

### Core user story (designer)
1. Upload base dress photo (PNG) + metadata (dress category, style keywords, optional desired color/print).
2. See an auto-generated prompt; optionally tweak it.
3. See top recommended backgrounds and models; pick one of each.
4. Click Generate; watch progress.
5. Review results in a gallery with QA flags; approve, reject, regenerate.
6. After approval, generate additional angles (front/side/back/3-4 view).

### MVP features (must ship first)
- Upload + catalog dress images + metadata.
- Prompt template system with placeholders; prompt history logging.
- Background library (10–15) + model library (pre-generated) with tags.
- Recommendation service:
  - Filter by tags/category.
  - Rank via CLIP embeddings (image↔image and/or text↔image).
  - Show top 2–3 suggestions for each (backgrounds + models).
- Image generation:
  - Staged generation: (A) apply print/color to the dress, then (B) generate final composite with selected model/background.
  - Store request parameters and outputs; support regeneration attempts.
- Automated QA (baseline):
  - Blur check (heuristic).
  - Prompt/image alignment check (CLIP similarity or BLIP caption → similarity).
  - “Anomaly” score; flag failures; optionally auto-regenerate up to `N` attempts.
- Dashboard (React):
  - Uploader + metadata form
  - Prompt preview/edit
  - Background + model pickers (with thumbnails)
  - Job progress + output gallery
  - Per-image approve/reject + regenerate
  - Prompt history/log view

### Phase 2 (after MVP)
- Multi-angle with Stable Zero-1-to-3 (“Zero123”) for consistent viewpoints; fallback prompt-based angles stays available.
- Optional “prompt refinement loop” using a small LLM for paraphrasing + negative prompt generation.
- Better anatomy/artifact checks (pose estimation or specialized classifiers).
- Auth + team roles + audit logs.
- Production storage (S3/GCS) + CDN.

## 2) Architecture (recommended default)

### Components
- **Frontend**: React + MUI dashboard.
- **Backend API**: Python + FastAPI (REST; optional WebSocket/SSE for progress).
- **Worker**: background job runner for generation/QA/embedding (Celery + Redis or RQ).
- **DB**: PostgreSQL (recommended) to store metadata, prompts, jobs, results.
- **Vector search**: Postgres + pgvector (recommended) for asset embedding search (or FAISS as a fallback).
- **Blob storage**: local filesystem for dev; S3/GCS in prod (behind a storage abstraction).
- **AI services**:
  - Image generation: Google Gemini image model (“Nano Banana Pro”) via Generative Language API.
  - VLM/embeddings: CLIP for similarity; BLIP/BLIP-2 optional for captions.
  - Multi-angle: Stable Zero-1-to-3 (local GPU) when enabled.

### Data flow (happy path)
1. Dress upload → stored blob + DB record.
2. Prompt generated from template + metadata → stored.
3. Recommendations: dress metadata filters candidates; CLIP ranks; UI shows top picks.
4. Generate job created → worker runs:
   - Stage A: “design generation” (apply print/color to dress).
   - Stage B: “final composite” with selected model/background.
   - QA pass/fail; retry loop as configured.
   - Multi-angle generation if enabled; QA for each view.
5. Results stored → UI polls/streams job status → designer approves/rejects.

## 3) Data model (DB schema)

Use relational tables; store images as blobs in object storage and keep URLs/paths in DB.

### Tables (minimum)
- `dress`
  - `id` (uuid), `created_at`
  - `original_image_url`
  - `category` (e.g. beachwear/evening/casual)
  - `style_keywords` (text[] or json)
  - `desired_color_scheme` (optional)
  - `desired_print` (optional)
  - `notes` (optional)
- `asset_background`
  - `id`, `created_at`
  - `image_url`
  - `tags` (json/text[])
  - `theme` (beach/party/nature/…)
  - `embedding` (vector)
- `asset_model`
  - `id`, `created_at`
  - `image_url`
  - `tags` (json/text[])
  - `ethnicity` (optional), `pose` (optional), `attributes` (json)
  - `embedding` (vector)
- `prompt_template`
  - `id`, `name`, `version`, `created_at`
  - `template_text` (with placeholders)
  - `negative_template_text` (optional)
  - `input_schema` (json describing allowed placeholders)
- `prompt_run`
  - `id`, `created_at`
  - `dress_id`
  - `template_id`
  - `filled_prompt_text`, `filled_negative_text` (optional)
  - `inputs` (json: category/style/color/print/etc)
- `generation_job`
  - `id`, `created_at`, `updated_at`
  - `dress_id`, `prompt_run_id`
  - `selected_background_id`, `selected_model_id`
  - `status` (queued/running/succeeded/failed)
  - `attempt_count`, `max_attempts`
  - `config` (json: angles list, model name, thresholds)
  - `error` (nullable)
- `generated_image`
  - `id`, `created_at`
  - `job_id`
  - `stage` (design|final|angle)
  - `angle` (nullable: front/side/back/three_quarter)
  - `image_url`
  - `metadata` (json: request params, model, any seed if supported)
  - `qa_status` (pass/fail/warn/pending)
  - `qa_details` (json)
  - `human_status` (approved/rejected/pending)
  - `human_feedback` (text nullable)

## 4) Backend API (REST)

All endpoints return JSON; uploads use `multipart/form-data`.

### Dress ingestion
- `POST /api/dresses`
  - form fields:
    - `image` (file, PNG)
    - `category` (string)
    - `style_keywords` (string; comma-separated or JSON)
    - optional: `desired_color_scheme`, `desired_print`, `notes`
  - returns: `dress`
- `GET /api/dresses/{dress_id}`
- `GET /api/dresses` (list + pagination)

### Asset management (backgrounds/models)
- `POST /api/assets/backgrounds` (upload + tags)
- `POST /api/assets/models` (upload + tags)
- `GET /api/assets/backgrounds`
- `GET /api/assets/models`
- `POST /api/assets/{type}/{id}/re-embed` (recompute CLIP embedding)

### Recommendations
- `GET /api/recommendations?dress_id=...`
  - returns:
    - `backgrounds`: [{`id`, `score`, `tags`, `thumbnail_url`}, …]
    - `models`: [{`id`, `score`, `tags`, `thumbnail_url`}, …]

### Prompt templates + history
- `GET /api/prompt-templates`
- `POST /api/prompt-templates` (create/update versions)
- `POST /api/prompt-runs/preview`
  - body: dress metadata + template id + overrides
  - returns: filled prompt text(s)
- `GET /api/dresses/{dress_id}/prompt-runs`

### Generation jobs
- `POST /api/jobs`
  - body:
    - `dress_id`
    - `prompt_run_id` (or inline overrides that create one)
    - `background_id`, `model_id`
    - `angles` (optional; default empty for MVP)
  - returns: `job` (id + status)
- `GET /api/jobs/{job_id}` (status + generated images)
- `POST /api/jobs/{job_id}/regenerate`
  - body: optional `stage`, optional `angle`, optional prompt overrides
- `POST /api/generated-images/{image_id}/review`
  - body: `status` = approved|rejected, optional `feedback`

### Progress updates (choose one)
- MVP: frontend polls `GET /api/jobs/{job_id}` every 1–2s.
- Phase 2: add `GET /api/jobs/{job_id}/events` (SSE) or WebSocket channel.

## 5) Core services (implementation details)

### 5.1 Prompt templating
- Store templates with placeholders: `{category}`, `{style_keywords}`, `{desired_print}`, `{desired_color_scheme}`, `{background_theme}`, `{model_tags}`.
- Provide “canned examples” by shipping 3–5 preset templates for common categories (beachwear/party/evening/casual).
- Support a negative prompt template (optional) to reduce artifacts (e.g., “no extra limbs, no blur, no text”).
- Log every filled prompt + inputs + job outputs (prompt_run + generated_image.metadata).

### 5.2 Background/model recommendation (CLIP)
1. Candidate filtering:
   - Filter assets by theme/category tags (e.g. dress category beachwear → background theme beach).
2. Scoring:
   - Compute CLIP image embedding for the dress *design image* when available; otherwise use the original dress image + metadata text embedding.
   - Rank candidate backgrounds and models by cosine similarity.
   - Optionally blend with tag-match score: `score = 0.8 * clip + 0.2 * tag_match`.
3. Return top K (K=3) backgrounds and models.

Embedding storage:
- Compute embeddings at asset ingest time and store in DB (`embedding` column).
- Compute dress embedding on demand and cache it in DB (optional).

### 5.3 Image generation (Gemini / Nano Banana)
Implement a provider interface, e.g. `ImageGenProvider.generate(parts, config) -> image_bytes`.

Recommended staged prompts:
- **Stage A (design overlay)**: input = original dress image + “apply print/color” prompt; output = styled dress image.
- **Stage B (final composite)**: input = styled dress image + selected background image + selected model image + scene prompt; output = final product image.

Gemini API call shape (Generative Language API):
- POST `https://generativelanguage.googleapis.com/v1beta/{MODEL}:generateContent?key=...`
- payload:
  - `contents`: [{`role`: "user", `parts`: [ {`text`: PROMPT}, {`inlineData`: {`mimeType`, `data`}}, ... ]}]
  - `generationConfig`:
    - `responseModalities`: `["TEXT","IMAGE"]`
    - optionally `imageConfig` (aspect ratio / image size derived from input)

Response parsing:
- candidates[0].content.parts includes an `inlineData` (or `inline_data`) part with `data` (base64) for the image.

Logging/reproducibility:
- Store the exact prompt, model name, and request payload (minus API key) in `generated_image.metadata`.
- If the chosen model supports deterministic seeds, pass + record `seed`; otherwise record a locally generated `request_id` for traceability.

### 5.4 Automated QA (VLM + heuristics)
Implement `qa_check(image) -> {status, reasons, scores}`.

Baseline checks (MVP):
- **Blur**: variance of Laplacian < threshold → fail (tunable).
- **Prompt alignment**:
  - CLIP similarity between expected prompt text and generated image.
  - Optional: BLIP caption → compare caption text to expected prompt via CLIP text similarity.
- **Basic mismatch rules**:
  - If desired color scheme is provided, run a simple dominant-color check and flag obvious mismatch (warn, not fail, for MVP).

Retry policy:
- If QA fails, auto-regenerate up to `max_attempts`:
  - change randomization (if supported),
  - or append a negative prompt clause (“no blur, no extra limbs, realistic anatomy”),
  - or simplify prompt (remove conflicting style terms).
- Persist all failed attempts for inspection.

### 5.5 Multi-angle generation
Angles target list: `["front","three_quarter","side","back"]`.

Preferred (Phase 2):
- If Zero123 is enabled, feed the approved “final” image and request viewpoint deltas (±15–30 degrees), mapping outputs to the angle list.

Fallback (MVP-compatible):
- Re-run the image model with prompt edits:
  - “same model and background, same outfit, front view”
  - “same scene, side view”, etc.
- Run QA on each angle; allow per-angle regenerate in UI.

## 6) Frontend (React) implementation plan

### Pages / routes
- `/` Dashboard:
  - Dress upload + metadata form
  - Prompt preview + edit
  - Recommendations panel: backgrounds + models (radio-card selection)
  - Generate button + progress indicator
  - Output gallery (cards: image + QA tags + approve/reject/regenerate)
  - Logs panel (prompt history + job attempts)

### Key components (MUI)
- `DressUploader`
- `MetadataForm`
- `PromptPreviewEditor`
- `AssetSelector` (backgrounds/models)
- `GenerateJobPanel` (progress + status)
- `OutputGallery`
- `ImageCard` (QA badges + actions)
- `PromptHistoryDrawer`

### Frontend data handling
- Use a typed API client (OpenAPI-generated client or a small wrapper).
- Job status polling until terminal state (succeeded/failed).
- Store UI state so a refresh can restore the last job by id (localStorage).

## 7) Configuration (env vars)

Backend:
- `DATABASE_URL`
- `REDIS_URL` (if using a worker/queue)
- `STORAGE_BACKEND` = `local`|`s3`|`gcs`
- `STORAGE_LOCAL_DIR` (dev)
- `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)
- `GEMINI_IMAGE_MODEL` (e.g. a Gemini image-capable model name)
- `QA_BLUR_THRESHOLD` (float/int)
- `QA_CLIP_THRESHOLD` (float)
- `MAX_GENERATION_ATTEMPTS` (int)
- `ENABLE_ZERO123` (0/1)

Frontend:
- `VITE_API_BASE_URL`

## 8) Step-by-step build plan (what the implementing agent should do)

### Step 0 — Repo scaffold
- Create a monorepo layout:
  - `backend/` (FastAPI app)
  - `frontend/` (React app)
  - `docker-compose.yml` (postgres + redis)
  - `.env.example` (all required env vars)
  - `README.md` (how to run)

Acceptance criteria:
- `docker compose up` starts DB (and Redis if used).
- `backend` runs locally and serves `/health`.
- `frontend` runs locally and loads the dashboard shell.

### Step 1 — Backend foundations
- Implement FastAPI app structure:
  - settings/config module (env parsing)
  - DB connection + migrations
  - storage abstraction (local filesystem first)
  - background job runner abstraction (sync inline first, then worker)
- Add models for `dress`, `asset_background`, `asset_model`, `prompt_template`, `prompt_run`, `generation_job`, `generated_image`.

Acceptance criteria:
- CRUD for dresses and assets works end-to-end (upload + list + get).

### Step 2 — Asset ingestion + embeddings
- Implement CLIP embedding service:
  - compute embedding for an image (background/model)
  - store in DB (pgvector recommended)
- Add an “ingest assets” script/endpoint that:
  - accepts upload, tags/theme, computes embedding, stores record.

Acceptance criteria:
- `GET /api/assets/backgrounds` and `GET /api/assets/models` return assets with embeddings stored.

### Step 3 — Prompt templates + prompt run logging
- Ship default templates:
  - Design overlay template (print/color onto dress)
  - Final composite template (model + background + styled dress)
  - Angle template (front/side/back/3-4)
- Implement template fill + preview endpoint.
- Log every run in `prompt_run`.

Acceptance criteria:
- UI can preview/edit the generated prompt text before running a job.

### Step 4 — Recommendations
- Implement `GET /api/recommendations?dress_id=...`:
  - filter by category/tags
  - compute dress embedding (from original or styled design when available)
  - cosine rank backgrounds + models
  - return top 3 each

Acceptance criteria:
- UI shows top ranked suggestions with scores and thumbnails.

### Step 5 — Generation job pipeline
- Implement job creation endpoint + job status endpoint.
- Implement worker task (or inline execution for MVP) to:
  - Stage A: generate styled dress image
  - Stage B: generate final composite
  - store outputs as `generated_image` rows + blobs

Acceptance criteria:
- Creating a job produces at least one “final” image and stores it.

### Step 6 — QA + regeneration loop
- Implement QA checks (blur + CLIP alignment) and mark images pass/fail/warn.
- Implement configurable retry loop on failure, storing failed attempts.
- Expose QA results to frontend; show badges + reasons.

Acceptance criteria:
- Failed images are flagged and can be regenerated from the UI.

### Step 7 — Multi-angle generation
- Add an “angles” option to job config (default off in MVP).
- Implement fallback prompt-based angle generation first.
- (Phase 2) Integrate Zero123 behind `ENABLE_ZERO123`.

Acceptance criteria:
- For a job with angles enabled, gallery shows 4 angle outputs with QA statuses.

### Step 8 — Human review + feedback
- Implement approve/reject endpoint for each generated image.
- Store feedback text and status; allow exporting only approved images.

Acceptance criteria:
- UI supports approve/reject and persists decisions in DB.

### Step 9 — Observability and ops
- Add structured logging (job_id, dress_id, stage, attempt).
- Store error details on job failure; surface in UI.
- Add basic rate limits/timeouts around external API calls.

Acceptance criteria:
- Failures are diagnosable from logs + job error fields; UI shows actionable error messages.

### Step 10 — Deployment
- Dockerize backend + frontend.
- Provide a production `docker-compose` or deployment notes for cloud GPU (only needed if running local VLM/Zero123).

Acceptance criteria:
- A single documented command starts the full stack locally with sample assets.

## 9) Notes / constraints to keep in mind
- Human-in-loop is a product requirement: recommendations are suggestions; designer makes final choices.
- Keep all prompts + outputs traceable: store prompts, parameters, timestamps, and QA outcomes for each attempt.
- Design for model swap: treat “image generation” and “VLM QA” as provider interfaces so Nano Banana/Zero123 can be replaced later.

