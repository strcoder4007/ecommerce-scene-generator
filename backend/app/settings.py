from __future__ import annotations

from pydantic import BaseModel


class Settings(BaseModel):
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    gemini_api_key: str | None = None
    gemini_vto_model: str = "gemini-3-pro-image-preview"
    gemini_use_image_config: bool = False

    request_timeout_seconds: int = 120

    @staticmethod
    def from_env() -> "Settings":
        import os

        try:
            from dotenv import load_dotenv

            load_dotenv()
        except Exception:
            pass

        cors_origins_raw = os.environ.get("CORS_ORIGINS", "").strip()
        cors_origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()] if cors_origins_raw else None

        gemini_api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or None

        gemini_vto_model = os.environ.get("GEMINI_VTO_MODEL", "gemini-3-pro-image-preview").strip()

        gemini_use_image_config = os.environ.get("GEMINI_USE_IMAGE_CONFIG", "0").strip().lower() in {
            "1",
            "true",
            "yes",
            "on",
        }

        request_timeout_seconds = int(os.environ.get("GEMINI_REQUEST_TIMEOUT_SECONDS", "120"))

        return Settings(
            cors_origins=cors_origins or Settings().cors_origins,
            gemini_api_key=gemini_api_key,
            gemini_vto_model=gemini_vto_model,
            gemini_use_image_config=gemini_use_image_config,
            request_timeout_seconds=request_timeout_seconds,
        )
