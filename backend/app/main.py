from __future__ import annotations

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
    LookPlanError,
    choose_background,
    choose_model,
    generate_final_prompt,
    plan_look_from_garment,
)
from .models import AssetOut, GenerateLookResponse
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

        garment_mime_type = (garment_photo.content_type or "image/jpeg").split(";")[0].strip()
        garment_bytes = await garment_photo.read()
        if not garment_bytes:
            return JSONResponse({"error": "Uploaded garment_photo is empty"}, status_code=400)

        backgrounds = app.state.db.list_assets(asset_type="background")
        models = app.state.db.list_assets(asset_type="model")

        # If the user picks explicit IDs, use them. Otherwise plan + choose.
        chosen_background = None
        if background_id and background_id.strip():
            chosen_background = app.state.db.get_asset(
                asset_type="background", asset_id=background_id.strip()
            )
            if not chosen_background:
                return JSONResponse({"error": "Selected background_id not found"}, status_code=400)

        chosen_model = None
        if model_id and model_id.strip():
            chosen_model = app.state.db.get_asset(asset_type="model", asset_id=model_id.strip())
            if not chosen_model:
                return JSONResponse({"error": "Selected model_id not found"}, status_code=400)

        available_themes = sorted({(b.theme or "").strip() for b in backgrounds if (b.theme or "").strip()})
        available_ethnicities = sorted({(m.ethnicity or "").strip() for m in models if (m.ethnicity or "").strip()})

        overrides: dict[str, str | None] = {
            "occasion": (occasion or "").strip() or None,
            "color_scheme": (color_scheme or "").strip() or None,
            "print_style": (print_style or "").strip() or None,
            "background_theme": (background_theme or "").strip() or None,
            "model_ethnicity": (model_ethnicity or "").strip() or None,
            "model_styling_notes": (model_styling_notes or "").strip() or None,
        }

        # Reasoning step: fill in missing style info.
        plan_error: str | None = None
        try:
            plan = plan_look_from_garment(
                api_key=settings.gemini_api_key,
                model=settings.gemini_text_model,
                garment_bytes=garment_bytes,
                garment_mime_type=garment_mime_type,
                available_background_themes=available_themes,
                available_model_ethnicities=available_ethnicities,
                user_overrides=overrides,
                timeout_seconds=settings.request_timeout_seconds,
            )
        except LookPlanError as exc:
            # Don't block generation if the planner fails; fall back to a simple plan.
            plan_error = str(exc)
            plan = LookPlan(
                occasion=overrides.get("occasion") or "casual",
                color_scheme=overrides.get("color_scheme") or "as-is",
                print_style=overrides.get("print_style") or "as-is",
                style_keywords=[],
                background_theme=overrides.get("background_theme") or (overrides.get("occasion") or "casual"),
                accessories=[],
                negative_prompt="blurry, low quality, extra limbs, text, watermark",
                model_ethnicity=overrides.get("model_ethnicity") or "",
                model_styling_notes=overrides.get("model_styling_notes") or "",
            )

        # Apply freeform user overrides for keywords/accessories if provided.
        if style_keywords and style_keywords.strip():
            plan = plan.__class__(
                **{**plan.__dict__, "style_keywords": _parse_tags(style_keywords)}
            )
        if accessories and accessories.strip():
            plan = plan.__class__(
                **{**plan.__dict__, "accessories": _parse_tags(accessories)}
            )

        if not chosen_background and backgrounds:
            chosen_background = choose_background(backgrounds, plan.background_theme)
        if not chosen_model and models:
            chosen_model = choose_model(models, plan.model_ethnicity)

        # Stage A: generate a styled garment reference image.
        preserve_as_is = (
            (plan.color_scheme or "").strip().lower() in {"as-is", "as is", "asis", "original", "same as photo"}
            or (plan.print_style or "").strip().lower() in {"as-is", "as is", "asis", "original", "same as photo"}
        )
        garment_design_prompt = (
            "Using the GARMENT PHOTO, create a clean catalog-style image of the same garment on a plain neutral background. "
            + (
                "Preserve the garment's existing color and print exactly as in the photo. "
                if preserve_as_is
                else f"Apply this design: color scheme = {plan.color_scheme}; print style = {plan.print_style}. "
            )
            + f"Style keywords: {', '.join(plan.style_keywords) if plan.style_keywords else 'none'}. "
            + "Keep the silhouette/shape identical. No person, no mannequin, no text."
        )

        try:
            styled_garment = generate_image(
                api_key=settings.gemini_api_key,
                model=settings.gemini_vto_model,
                prompt_text=garment_design_prompt,
                images=[(garment_mime_type, garment_bytes)],
                use_image_config=settings.gemini_use_image_config,
                timeout_seconds=settings.request_timeout_seconds,
            )
        except GeminiError as exc:
            return JSONResponse({"error": str(exc)}, status_code=502)

        styled_garment_bytes = None
        styled_garment_decoded_ok = False
        try:
            import base64 as _b64

            styled_garment_bytes = _b64.b64decode(styled_garment.image_base64)
            styled_garment_decoded_ok = True
        except Exception:
            styled_garment_bytes = None

        # Load selected background/model images.
        bg_bytes = None
        model_bytes = None
        if chosen_background:
            bg_path = (storage_root / chosen_background.file_path).resolve()
            bg_bytes = bg_path.read_bytes()
        if chosen_model:
            model_path = (storage_root / chosen_model.file_path).resolve()
            model_bytes = model_path.read_bytes()

        # Prompt generation step.
        try:
            final_prompt = generate_final_prompt(
                api_key=settings.gemini_api_key,
                model=settings.gemini_text_model,
                plan=plan,
                background=chosen_background,
                chosen_model=chosen_model,
                has_background_reference=bool(chosen_background),
                has_model_reference=bool(chosen_model),
                timeout_seconds=settings.request_timeout_seconds,
            )
        except Exception:
            final_prompt = (
                "Photorealistic ecommerce fashion photo, one female model wearing the garment from the GARMENT PHOTO, "
                f"{plan.occasion} style, {plan.color_scheme} color scheme, {plan.print_style} print, "
                f"set in a {plan.background_theme or 'relevant'} background, natural lighting, realistic fabric drape."
            )

        # Stage B: generate final composite using MODEL + styled GARMENT + BACKGROUND references.
        composite_lines: list[str] = [
            "You are generating a photorealistic ecommerce fashion photo.",
            "The FIRST image is the GARMENT PHOTO (use the exact garment design).",
        ]
        if styled_garment_decoded_ok and styled_garment_bytes:
            images_for_composite: list[tuple[str, bytes]] = [
                (styled_garment.mime_type, styled_garment_bytes)
            ]
        else:
            images_for_composite = [(garment_mime_type, garment_bytes)]

        if chosen_model and model_bytes:
            composite_lines.append(
                "The SECOND image is the MODEL PHOTO (use her identity, face, pose, and body proportions)."
            )
            images_for_composite.append((chosen_model.mime_type, model_bytes))
        else:
            composite_lines.append(
                "No model reference is provided: create a suitable single female fashion model"
                + (f" (prefer {plan.model_ethnicity})" if plan.model_ethnicity else "")
                + "."
            )

        if chosen_background and bg_bytes:
            composite_lines.append("The LAST image is the BACKGROUND PHOTO (use it as the scene).")
            images_for_composite.append((chosen_background.mime_type, bg_bytes))
        else:
            composite_lines.append(
                "No background reference is provided: create a photorealistic background matching "
                + (plan.background_theme or plan.occasion)
                + "."
            )

        composite_lines.extend(
            [
                "The final image must show the model wearing the garment from the garment photo.",
                "Keep anatomy correct. Do not add extra people. No text, logos, or watermarks.",
                final_prompt,
                f"Avoid: {plan.negative_prompt}",
            ]
        )
        composite_prompt = "\n".join(composite_lines).strip()

        try:
            result = generate_image(
                api_key=settings.gemini_api_key,
                model=settings.gemini_vto_model,
                prompt_text=composite_prompt,
                images=images_for_composite,
                use_image_config=settings.gemini_use_image_config,
                timeout_seconds=settings.request_timeout_seconds,
            )
        except GeminiError as exc:
            return JSONResponse({"error": str(exc)}, status_code=502)

        chosen_payload = {
            "occasion": plan.occasion,
            "color_scheme": plan.color_scheme,
            "print_style": plan.print_style,
            "style_keywords": plan.style_keywords,
            "accessories": plan.accessories,
            "background_theme": plan.background_theme,
            "model_ethnicity": plan.model_ethnicity,
            "background": {
                "id": chosen_background.id if chosen_background else None,
                "title": chosen_background.title if chosen_background else None,
                "theme": chosen_background.theme if chosen_background else None,
            },
            "model": {
                "id": chosen_model.id if chosen_model else None,
                "title": chosen_model.title if chosen_model else None,
                "ethnicity": chosen_model.ethnicity if chosen_model else None,
            },
        }

        debug_payload = None
        if include_debug:
            debug_payload = {
                "plan_error": plan_error,
                "final_prompt": final_prompt,
                "composite_prompt": composite_prompt,
                "negative_prompt": plan.negative_prompt,
                "background_tags": chosen_background.tags if chosen_background else [],
                "model_tags": chosen_model.tags if chosen_model else [],
            }

        return JSONResponse(
            {
                "mime_type": result.mime_type,
                "image_base64": result.image_base64,
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
