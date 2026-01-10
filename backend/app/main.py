from __future__ import annotations

import time
import uuid
from dataclasses import replace

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .db import AppDb
from .gemini_vto import (
    GeminiError,
    build_virtual_try_on_prompt,
    generate_image,
    generate_virtual_try_on,
)
from .look_planner import (
    LookPlan,
    LookOverrides,
    LookPlanError,
    choose_background,
    choose_model,
    generate_final_prompt,
    plan_look_from_garment,
)
from .models import AssetOut, GenerateLookResponse
from .pipeline_context import GenerateLookUserOptions, PipelineContext
from .settings import Settings
from .storage import allocate_asset_path, get_storage_dir, write_bytes


def _parse_tags(raw: str | None) -> list[str]:
    if not raw:
        return []
    parts = [p.strip() for p in raw.replace(";", ",").split(",")]
    seen: set[str] = set()
    tags: list[str] = []
    for p in parts:
        if not p:
            continue
        key = p.lower()
        if key in seen:
            continue
        seen.add(key)
        tags.append(p)
    return tags


def _asset_to_out(asset_type: str, rec) -> AssetOut:
    image_url = f"/api/assets/{asset_type}s/{rec.id}/image"
    return AssetOut(
        id=rec.id,
        title=rec.title,
        theme=rec.theme,
        ethnicity=rec.ethnicity,
        tags=rec.tags,
        image_url=image_url,
        created_at=rec.created_at,
    )


def create_app() -> FastAPI:
    settings = Settings.from_env()
    if settings.storage_dir:
        import os

        os.environ["STORAGE_DIR"] = settings.storage_dir

    app = FastAPI(title="Ecommerce Scene Generator API", version="0.1.0")

    storage_root = get_storage_dir()
    db = AppDb(storage_root / "app.db")
    db.init()
    app.state.db = db

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/assets/backgrounds", response_model=list[AssetOut])
    def list_backgrounds() -> list[AssetOut]:
        assets = app.state.db.list_assets(asset_type="background")
        return [_asset_to_out("background", a) for a in assets]

    @app.get("/api/assets/models", response_model=list[AssetOut])
    def list_models() -> list[AssetOut]:
        assets = app.state.db.list_assets(asset_type="model")
        return [_asset_to_out("model", a) for a in assets]

    @app.post("/api/assets/backgrounds", response_model=AssetOut)
    async def upload_background(
        image: UploadFile = File(...),
        title: str | None = Form(None),
        theme: str | None = Form(None),
        tags: str | None = Form(None),
    ) -> AssetOut:
        image_bytes = await image.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Uploaded image is empty")

        mime_type = (image.content_type or "application/octet-stream").split(";")[0].strip()
        asset_id, rel_path = allocate_asset_path(
            asset_type="background", filename=image.filename, mime_type=mime_type
        )
        write_bytes(relative_path=rel_path, data=image_bytes)

        rec = app.state.db.insert_asset(
            asset_id=asset_id,
            asset_type="background",
            title=(title or theme or "Background").strip(),
            theme=(theme or "").strip() or None,
            ethnicity=None,
            tags=_parse_tags(tags),
            file_path=rel_path,
            mime_type=mime_type,
        )
        return _asset_to_out("background", rec)

    @app.post("/api/assets/models", response_model=AssetOut)
    async def upload_model(
        image: UploadFile = File(...),
        title: str | None = Form(None),
        ethnicity: str | None = Form(None),
        tags: str | None = Form(None),
    ) -> AssetOut:
        image_bytes = await image.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Uploaded image is empty")

        mime_type = (image.content_type or "application/octet-stream").split(";")[0].strip()
        asset_id, rel_path = allocate_asset_path(
            asset_type="model", filename=image.filename, mime_type=mime_type
        )
        write_bytes(relative_path=rel_path, data=image_bytes)

        rec = app.state.db.insert_asset(
            asset_id=asset_id,
            asset_type="model",
            title=(title or ethnicity or "Model").strip(),
            theme=None,
            ethnicity=(ethnicity or "").strip() or None,
            tags=_parse_tags(tags),
            file_path=rel_path,
            mime_type=mime_type,
        )
        return _asset_to_out("model", rec)

    @app.post("/api/generate-look", response_model=GenerateLookResponse)
    async def generate_look(
        garment_photo: UploadFile = File(...),
        background_id: str | None = Form(None),
        model_id: str | None = Form(None),
        occasion: str | None = Form(None),
        color_scheme: str | None = Form(None),
        print_style: str | None = Form(None),
        background_theme: str | None = Form(None),
        model_ethnicity: str | None = Form(None),
        model_styling_notes: str | None = Form(None),
        style_keywords: str | None = Form(None),
        accessories: str | None = Form(None),
        include_debug: bool = Form(False),
    ) -> JSONResponse:
        if not settings.gemini_api_key:
            return JSONResponse(
                {
                    "error": "Missing API key. Set GEMINI_API_KEY (or GOOGLE_API_KEY) in your environment."
                },
                status_code=500,
            )

        garment_mime_type = (
            (garment_photo.content_type or "image/jpeg").split(";")[0].strip()
        )
        garment_bytes = await garment_photo.read()
        if not garment_bytes:
            return JSONResponse(
                {"error": "Uploaded garment_photo is empty"}, status_code=400
            )

        request_id = uuid.uuid4().hex
        options = GenerateLookUserOptions(
            background_id=(background_id or "").strip() or None,
            model_id=(model_id or "").strip() or None,
            overrides=LookOverrides(
                occasion=(occasion or "").strip() or None,
                color_scheme=(color_scheme or "").strip() or None,
                print_style=(print_style or "").strip() or None,
                background_theme=(background_theme or "").strip() or None,
                model_ethnicity=(model_ethnicity or "").strip() or None,
                model_styling_notes=(model_styling_notes or "").strip() or None,
            ),
            style_keywords=(style_keywords or "").strip() or None,
            accessories=(accessories or "").strip() or None,
            include_debug=include_debug,
        )
        ctx = PipelineContext(
            request_id=request_id,
            garment_mime_type=garment_mime_type,
            garment_bytes=garment_bytes,
            options=options,
        )

        ctx.backgrounds = app.state.db.list_assets(asset_type="background")
        ctx.models = app.state.db.list_assets(asset_type="model")

        # Resolve explicit asset selections first (if provided).
        t0 = time.perf_counter()
        if ctx.options.background_id:
            ctx.chosen_background = app.state.db.get_asset(
                asset_type="background", asset_id=ctx.options.background_id
            )
            if not ctx.chosen_background:
                return JSONResponse(
                    {"error": "Selected background_id not found"}, status_code=400
                )
        if ctx.options.model_id:
            ctx.chosen_model = app.state.db.get_asset(
                asset_type="model", asset_id=ctx.options.model_id
            )
            if not ctx.chosen_model:
                return JSONResponse({"error": "Selected model_id not found"}, status_code=400)
        ctx.timings["resolve_selected_assets"] = time.perf_counter() - t0

        available_themes = sorted(
            {
                (b.theme or "").strip()
                for b in ctx.backgrounds
                if (b.theme or "").strip()
            }
        )
        available_ethnicities = sorted(
            {
                (m.ethnicity or "").strip()
                for m in ctx.models
                if (m.ethnicity or "").strip()
            }
        )

        # Stage: plan the look from the garment photo.
        t0 = time.perf_counter()
        try:
            ctx.plan = plan_look_from_garment(
                api_key=settings.gemini_api_key,
                model=settings.gemini_text_model,
                garment_bytes=ctx.garment_bytes,
                garment_mime_type=ctx.garment_mime_type,
                available_background_themes=available_themes,
                available_model_ethnicities=available_ethnicities,
                user_overrides=ctx.options.overrides,
                timeout_seconds=settings.request_timeout_seconds,
            )
        except LookPlanError as exc:
            # Don't block generation if the planner fails; fall back to a simple plan.
            ctx.plan_error = str(exc)
            ov = ctx.options.overrides
            ctx.plan = LookPlan(
                occasion=ov.occasion or "casual",
                color_scheme=ov.color_scheme or "neutral",
                print_style=ov.print_style or "as-is",
                style_keywords=[],
                background_theme=ov.background_theme or (ov.occasion or "casual"),
                accessories=[],
                negative_prompt=(
                    "blurry, low quality, incorrect garment, altered design, wrong print, "
                    "extra limbs, deformed hands, text overlay, watermark"
                ),
                model_ethnicity=ov.model_ethnicity or "",
                model_styling_notes=ov.model_styling_notes or "",
            )
        ctx.timings["plan"] = time.perf_counter() - t0

        # Apply freeform user overrides for keywords/accessories if provided.
        if ctx.options.style_keywords:
            ctx.plan = replace(
                ctx.plan, style_keywords=_parse_tags(ctx.options.style_keywords)
            )
        if ctx.options.accessories:
            ctx.plan = replace(
                ctx.plan, accessories=_parse_tags(ctx.options.accessories)
            )

        # Pick assets if none were explicitly selected.
        if not ctx.chosen_background and ctx.backgrounds:
            ctx.chosen_background = choose_background(
                ctx.backgrounds, ctx.plan.background_theme
            )
        if not ctx.chosen_model and ctx.models:
            ctx.chosen_model = choose_model(ctx.models, ctx.plan.model_ethnicity)

        # Stage A: generate a clean garment reference image (for ecommerce accuracy).
        ctx.garment_design_prompt = "\n".join(
            [
                "You are generating a photorealistic ecommerce product reference image of a garment.",
                "The input image is a GARMENT PHOTO (often on a mannequin).",
                "Create a clean, high-resolution catalog cutout of the EXACT same garment on a plain light-neutral background.",
                "Hard rules:",
                "- Preserve the garment design exactly as in the input (color, print/pattern, logos/graphics, texture, seams, silhouette).",
                "- Do NOT add or remove design elements. Do NOT invent missing details. If unclear, keep it as-is.",
                "- Remove mannequin/body/stand and remove the original background.",
                "- Center the garment, keep it fully visible, keep proportions realistic.",
                "- No additional text, no watermark, no new logos.",
            ]
        ).strip()

        t0 = time.perf_counter()
        try:
            ctx.styled_garment = generate_image(
                api_key=settings.gemini_api_key,
                model=settings.gemini_vto_model,
                prompt_text=ctx.garment_design_prompt,
                images=[(ctx.garment_mime_type, ctx.garment_bytes)],
                use_image_config=settings.gemini_use_image_config,
                timeout_seconds=settings.request_timeout_seconds,
            )
        except GeminiError as exc:
            return JSONResponse({"error": str(exc)}, status_code=502)
        ctx.timings["garment_reference"] = time.perf_counter() - t0

        # Decode the reference image to bytes for use in the composite stage.
        try:
            import base64 as _b64

            ctx.styled_garment_bytes = _b64.b64decode(ctx.styled_garment.image_base64)
        except Exception:
            ctx.styled_garment_bytes = None

        # Load selected background/model images.
        t0 = time.perf_counter()
        if ctx.chosen_background:
            bg_path = (storage_root / ctx.chosen_background.file_path).resolve()
            ctx.background_bytes = bg_path.read_bytes()
        if ctx.chosen_model:
            model_path = (storage_root / ctx.chosen_model.file_path).resolve()
            ctx.model_bytes = model_path.read_bytes()
        ctx.timings["load_assets"] = time.perf_counter() - t0

        # Stage: write the final composite prompt.
        t0 = time.perf_counter()
        try:
            ctx.final_prompt = generate_final_prompt(
                api_key=settings.gemini_api_key,
                model=settings.gemini_text_model,
                plan=ctx.plan,
                background=ctx.chosen_background,
                chosen_model=ctx.chosen_model,
                has_background_reference=bool(ctx.chosen_background),
                has_model_reference=bool(ctx.chosen_model),
                timeout_seconds=settings.request_timeout_seconds,
            )
        except Exception:
            ctx.final_prompt = (
                "Photorealistic ecommerce fashion product photo, one female model wearing the garment from the GARMENT REFERENCE, "
                f"{ctx.plan.occasion} style, {ctx.plan.color_scheme} palette, garment print as in reference ({ctx.plan.print_style}), "
                f"set in a {ctx.plan.background_theme or 'relevant'} background, natural lighting, realistic fabric drape."
            )
        ctx.timings["final_prompt"] = time.perf_counter() - t0

        # Stage B: generate final composite using MODEL + GARMENT + BACKGROUND references.
        composite_lines: list[str] = [
            "You are generating a photorealistic ecommerce fashion product photo for an online store.",
            "The product is the hero: keep the garment accurate and undistorted.",
        ]

        if ctx.styled_garment_bytes and ctx.styled_garment:
            composite_lines.append(
                "IMAGE 1 is the GARMENT REFERENCE (clean catalog cutout derived from the input garment photo). "
                "Use it as the single source of truth for garment design (color, print, texture, seams, silhouette)."
            )
            ctx.images_for_composite = [
                (ctx.styled_garment.mime_type, ctx.styled_garment_bytes)
            ]
        else:
            composite_lines.append(
                "IMAGE 1 is the GARMENT PHOTO (often on a mannequin). "
                "Use it as the single source of truth for garment design; ignore mannequin and original background."
            )
            ctx.images_for_composite = [(ctx.garment_mime_type, ctx.garment_bytes)]

        if ctx.chosen_model and ctx.model_bytes:
            composite_lines.append(
                "IMAGE 2 is the MODEL PHOTO (use her identity, face, pose, and body proportions)."
            )
            ctx.images_for_composite.append((ctx.chosen_model.mime_type, ctx.model_bytes))
        else:
            composite_lines.append(
                "No model reference is provided: create a suitable single female fashion model"
                + (f" (prefer {ctx.plan.model_ethnicity})" if ctx.plan.model_ethnicity else "")
                + "."
            )

        if ctx.chosen_background and ctx.background_bytes:
            composite_lines.append(
                "The LAST image is the BACKGROUND PHOTO (use it as the scene)."
            )
            ctx.images_for_composite.append(
                (ctx.chosen_background.mime_type, ctx.background_bytes)
            )
        else:
            composite_lines.append(
                "No background reference is provided: create a photorealistic background matching "
                + (ctx.plan.background_theme or ctx.plan.occasion)
                + "."
            )

        composite_lines.extend(
            [
                "The final image must show ONE model wearing the EXACT garment from IMAGE 1.",
                "Do not change the garment design (no recolor, no print changes, no new logos/graphics, no missing straps).",
                "No added text overlays, no watermarks, no brand logos in the background.",
                "Keep anatomy correct. No extra people. No duplicates.",
                ctx.final_prompt,
                f"Avoid: {ctx.plan.negative_prompt}",
            ]
        )
        ctx.composite_prompt = "\n".join(composite_lines).strip()

        t0 = time.perf_counter()
        try:
            ctx.result = generate_image(
                api_key=settings.gemini_api_key,
                model=settings.gemini_vto_model,
                prompt_text=ctx.composite_prompt,
                images=ctx.images_for_composite,
                use_image_config=settings.gemini_use_image_config,
                timeout_seconds=settings.request_timeout_seconds,
            )
        except GeminiError as exc:
            return JSONResponse({"error": str(exc)}, status_code=502)
        ctx.timings["composite"] = time.perf_counter() - t0

        chosen_payload = {
            "occasion": ctx.plan.occasion,
            "color_scheme": ctx.plan.color_scheme,
            "print_style": ctx.plan.print_style,
            "style_keywords": ctx.plan.style_keywords,
            "accessories": ctx.plan.accessories,
            "background_theme": ctx.plan.background_theme,
            "model_ethnicity": ctx.plan.model_ethnicity,
            "background": {
                "id": ctx.chosen_background.id if ctx.chosen_background else None,
                "title": ctx.chosen_background.title if ctx.chosen_background else None,
                "theme": ctx.chosen_background.theme if ctx.chosen_background else None,
            },
            "model": {
                "id": ctx.chosen_model.id if ctx.chosen_model else None,
                "title": ctx.chosen_model.title if ctx.chosen_model else None,
                "ethnicity": ctx.chosen_model.ethnicity if ctx.chosen_model else None,
            },
        }

        debug_payload = None
        if ctx.options.include_debug:
            debug_payload = {
                "request_id": ctx.request_id,
                "timings": ctx.timings,
                "plan_error": ctx.plan_error,
                "final_prompt": ctx.final_prompt,
                "composite_prompt": ctx.composite_prompt,
                "negative_prompt": ctx.plan.negative_prompt,
                "background_tags": ctx.chosen_background.tags if ctx.chosen_background else [],
                "model_tags": ctx.chosen_model.tags if ctx.chosen_model else [],
            }

        return JSONResponse(
            {
                "mime_type": ctx.result.mime_type,
                "image_base64": ctx.result.image_base64,
                "chosen": chosen_payload,
                "debug": debug_payload,
            }
        )

    @app.get("/api/assets/backgrounds/{asset_id}/image")
    def get_background_image(asset_id: str) -> FileResponse:
        rec = app.state.db.get_asset(asset_type="background", asset_id=asset_id)
        if not rec:
            raise HTTPException(status_code=404, detail="Background not found")
        full = (storage_root / rec.file_path).resolve()
        return FileResponse(full, media_type=rec.mime_type)

    @app.get("/api/assets/models/{asset_id}/image")
    def get_model_image(asset_id: str) -> FileResponse:
        rec = app.state.db.get_asset(asset_type="model", asset_id=asset_id)
        if not rec:
            raise HTTPException(status_code=404, detail="Model not found")
        full = (storage_root / rec.file_path).resolve()
        return FileResponse(full, media_type=rec.mime_type)

    @app.post("/api/virtual-try-on")
    async def virtual_try_on(
        user_photo: UploadFile = File(...),
        garment_photo: UploadFile = File(...),
        garment_name: str | None = Form(None),
        garment_category: str | None = Form(None),
        garment_gender: str | None = Form(None),
        garment_brand: str | None = Form(None),
        garment_color: str | None = Form(None),
    ) -> JSONResponse:
        if not settings.gemini_api_key:
            return JSONResponse(
                {
                    "error": "Missing API key. Set GEMINI_API_KEY (or GOOGLE_API_KEY) in your environment."
                },
                status_code=500,
            )

        user_mime_type = (user_photo.content_type or "image/jpeg").split(";")[0].strip()
        garment_mime_type = (garment_photo.content_type or "image/jpeg").split(";")[0].strip()

        user_bytes = await user_photo.read()
        if not user_bytes:
            return JSONResponse({"error": "Uploaded user_photo is empty"}, status_code=400)

        garment_bytes = await garment_photo.read()
        if not garment_bytes:
            return JSONResponse({"error": "Uploaded garment_photo is empty"}, status_code=400)

        garment_description_parts: list[str] = []
        for part in [garment_brand, garment_name]:
            if part and part.strip():
                garment_description_parts.append(part.strip())
        garment_description = " ".join(garment_description_parts).strip() or "GARMENT from the GARMENT PHOTO"

        garment_meta_parts: list[str] = []
        for part in [garment_category, garment_color, garment_gender]:
            if part and part.strip():
                garment_meta_parts.append(part.strip())
        garment_meta = ", ".join(garment_meta_parts).strip()
        if garment_meta:
            garment_description = f"{garment_description} ({garment_meta})"

        prompt_text = build_virtual_try_on_prompt(garment_description=garment_description)

        try:
            result = generate_virtual_try_on(
                api_key=settings.gemini_api_key,
                model=settings.gemini_vto_model,
                prompt_text=prompt_text,
                user_bytes=user_bytes,
                user_mime_type=user_mime_type,
                garment_bytes=garment_bytes,
                garment_mime_type=garment_mime_type,
                use_image_config=settings.gemini_use_image_config,
                timeout_seconds=settings.request_timeout_seconds,
            )
        except GeminiError as exc:
            return JSONResponse({"error": str(exc)}, status_code=502)

        return JSONResponse(
            {"mime_type": result.mime_type, "image_base64": result.image_base64}
        )

    return app


app = create_app()
