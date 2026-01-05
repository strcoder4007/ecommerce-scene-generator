from __future__ import annotations

import base64
from dataclasses import dataclass
from io import BytesIO
from typing import Any

import json
import urllib.parse
import urllib.request
import urllib.error


def normalize_gemini_model_name(model: str) -> str:
    model = (model or "").strip()
    if not model:
        return "models/gemini-3-pro-image-preview"
    if model.startswith("models/") or model.startswith("tunedModels/"):
        return model
    return f"models/{model}"


def build_virtual_try_on_prompt(*, garment_description: str) -> str:
    garment_description = garment_description.strip() or "the GARMENT from the GARMENT PHOTO"
    return (
        "You are performing a virtual try-on.\n"
        "Use the PERSON PHOTO as the base image.\n"
        f"Replace the person's current outfit with {garment_description} from the GARMENT PHOTO.\n"
        "Preserve the person's identity, face, pose, body shape, skin tone, and the background.\n"
        "Keep lighting consistent and make the garment fit naturally with realistic folds.\n"
        "Do not add extra people, extra limbs, text, watermarks, or logos.\n"
        "Return a single photorealistic image."
    )


def try_get_image_dimensions(image_bytes: bytes) -> tuple[int, int] | None:
    try:
        from PIL import Image  # Lazy import; only needed when imageConfig is enabled.

        with Image.open(BytesIO(image_bytes)) as img:
            return img.size[0], img.size[1]
    except Exception:
        return None


def choose_supported_aspect_ratio(width: int, height: int) -> str | None:
    # Gemini imageConfig enums may vary by model/version. Keep conservative.
    # If the API rejects this, disable via GEMINI_USE_IMAGE_CONFIG=0.
    if width <= 0 or height <= 0:
        return None
    ratio = width / height
    if 0.9 <= ratio <= 1.1:
        return "ASPECT_RATIO_1_1"
    if ratio < 0.9:
        return "ASPECT_RATIO_3_4" if ratio >= 0.7 else "ASPECT_RATIO_9_16"
    return "ASPECT_RATIO_4_3" if ratio <= 1.5 else "ASPECT_RATIO_16_9"


def choose_image_size_for_input(width: int, height: int) -> str | None:
    # Keep modest sizes; many models default to 1024 anyway.
    # If the API rejects this, disable via GEMINI_USE_IMAGE_CONFIG=0.
    max_dim = max(width, height)
    if max_dim <= 768:
        return "IMAGE_SIZE_768"
    if max_dim <= 1024:
        return "IMAGE_SIZE_1024"
    return "IMAGE_SIZE_1536"


@dataclass(frozen=True)
class GeminiImageResult:
    mime_type: str
    image_base64: str


class GeminiError(RuntimeError):
    pass


def generate_virtual_try_on(
    *,
    api_key: str,
    model: str,
    prompt_text: str,
    user_bytes: bytes,
    user_mime_type: str,
    garment_bytes: bytes,
    garment_mime_type: str,
    use_image_config: bool,
    timeout_seconds: int,
) -> GeminiImageResult:
    model_name = normalize_gemini_model_name(model)
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:generateContent"

    generation_config: dict[str, Any] = {
        "temperature": 0.2,
        "responseModalities": ["TEXT", "IMAGE"],
    }

    if use_image_config:
        dims = try_get_image_dimensions(user_bytes)
        if dims:
            width, height = dims
            aspect_ratio = choose_supported_aspect_ratio(width, height)
            image_size = choose_image_size_for_input(width, height)
            if aspect_ratio or image_size:
                generation_config["imageConfig"] = {
                    **({"aspectRatio": aspect_ratio} if aspect_ratio else {}),
                    **({"imageSize": image_size} if image_size else {}),
                }

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": prompt_text},
                    {
                        "inlineData": {
                            "mimeType": user_mime_type,
                            "data": base64.b64encode(user_bytes).decode("utf-8"),
                        }
                    },
                    {
                        "inlineData": {
                            "mimeType": garment_mime_type,
                            "data": base64.b64encode(garment_bytes).decode("utf-8"),
                        }
                    },
                ],
            }
        ],
        "generationConfig": generation_config,
    }

    url = f"{endpoint}?{urllib.parse.urlencode({'key': api_key})}"
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            status_code = resp.getcode()
            raw_body = resp.read()
            content_type = resp.headers.get("Content-Type", "")
    except urllib.error.HTTPError as exc:
        status_code = exc.code
        raw_body = exc.read() if exc.fp else b""
        content_type = exc.headers.get("Content-Type", "") if exc.headers else ""
    except Exception as exc:
        raise GeminiError(f"Gemini API request failed: {exc}") from exc

    if status_code != 200:
        body_excerpt = raw_body[:500].decode("utf-8", errors="replace") if raw_body else ""
        raise GeminiError(f"Gemini API error ({status_code}): {body_excerpt}")

    try:
        result = json.loads(raw_body.decode("utf-8"))
    except Exception as exc:
        raise GeminiError(
            f"Gemini API returned non-JSON response (Content-Type: {content_type})"
        ) from exc

    parts = ((((result.get("candidates") or [{}])[0]).get("content") or {}).get("parts") or [])

    for part in parts:
        inline = part.get("inline_data") or part.get("inlineData")
        if inline and inline.get("data"):
            mime_type = inline.get("mime_type") or inline.get("mimeType") or "image/png"
            return GeminiImageResult(mime_type=mime_type, image_base64=inline["data"])

    raise GeminiError("Gemini API did not return an image")
