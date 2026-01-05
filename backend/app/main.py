from __future__ import annotations

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .gemini_vto import GeminiError, build_virtual_try_on_prompt, generate_virtual_try_on
from .settings import Settings


def create_app() -> FastAPI:
    settings = Settings.from_env()

    app = FastAPI(title="Ecommerce Scene Generator API", version="0.1.0")

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

