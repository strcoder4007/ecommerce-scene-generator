from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import Any

import json
import urllib.parse
import urllib.request
import urllib.error


_PROMPT_QUALITY_MARKER = "Photo quality requirements:"
_PROMPT_PHOTOSHOOT_QUALITY_BLOCK = """
Photo quality requirements:
- Photorealistic, high-resolution, ultra-sharp detail, crisp focus (no motion blur).
- Professional high-end fashion/product photoshoot look (studio-grade lighting, clean color, high dynamic range).
- Accurate textures (skin/fabric), natural shadows, realistic perspective and depth.
- Shot on a high-end camera with a premium lens; clean, natural bokeh where applicable.
- Avoid: low-res, blurry, noise, compression artifacts, over-smoothing/plastic look, CGI/cartoon look.
""".strip()


def _enhance_image_prompt(prompt_text: str) -> str:
    prompt_text = (prompt_text or "").strip()
    if not prompt_text:
        return _PROMPT_PHOTOSHOOT_QUALITY_BLOCK
    if _PROMPT_QUALITY_MARKER in prompt_text:
        return prompt_text
    return f"{prompt_text}\n\n{_PROMPT_PHOTOSHOOT_QUALITY_BLOCK}"


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
        "You are performing a virtual try-on for an ecommerce fashion photoshoot.\n"
        "Use the PERSON PHOTO as the base image.\n"
        f"Replace the person's current outfit with {garment_description} from the GARMENT PHOTO.\n"
        "Preserve the person's identity (face, hair), pose, body shape, skin tone, and the original background.\n"
        "Match the original scene lighting and perspective; keep shadows consistent.\n"
        "Make the garment fit naturally with realistic fabric drape, folds, and texture.\n"
        "Do not add extra people or limbs. Do not add text, watermarks, or logos.\n"
        "Return a single final image."
    )


def try_get_image_dimensions(image_bytes: bytes) -> tuple[int, int] | None:
    if not image_bytes or len(image_bytes) < 24:
        return None

    # PNG: https://www.w3.org/TR/PNG/#5PNG-file-signature
    if image_bytes.startswith(b"\x89PNG\r\n\x1a\n") and len(image_bytes) >= 24:
        try:
            width = int.from_bytes(image_bytes[16:20], "big")
            height = int.from_bytes(image_bytes[20:24], "big")
            if width > 0 and height > 0:
                return width, height
        except Exception:
            return None

    # JPEG: parse SOF markers.
    if image_bytes.startswith(b"\xff\xd8"):
        i = 2
        n = len(image_bytes)
        try:
            while i + 1 < n:
                # Find marker.
                if image_bytes[i] != 0xFF:
                    i += 1
                    continue
                marker = image_bytes[i + 1]
                i += 2

                # Skip padding.
                while marker == 0xFF and i < n:
                    marker = image_bytes[i]
                    i += 1

                # Standalone markers.
                if marker in {0xD8, 0xD9}:
                    continue

                # Start of Scan - image data follows; stop parsing.
                if marker == 0xDA:
                    break

                if i + 2 > n:
                    break
                seg_len = int.from_bytes(image_bytes[i : i + 2], "big")
                if seg_len < 2:
                    break

                sof_markers = {
                    0xC0,
                    0xC1,
                    0xC2,
                    0xC3,
                    0xC5,
                    0xC6,
                    0xC7,
                    0xC9,
                    0xCA,
                    0xCB,
                    0xCD,
                    0xCE,
                    0xCF,
                }
                if marker in sof_markers:
                    # length(2) + precision(1) + height(2) + width(2)
                    if i + 7 > n:
                        break
                    height = int.from_bytes(image_bytes[i + 3 : i + 5], "big")
                    width = int.from_bytes(image_bytes[i + 5 : i + 7], "big")
                    if width > 0 and height > 0:
                        return width, height

                i += seg_len
        except Exception:
            return None

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
    return generate_image(
        api_key=api_key,
        model=model,
        prompt_text=prompt_text,
        images=[(user_mime_type, user_bytes), (garment_mime_type, garment_bytes)],
        use_image_config=use_image_config,
        timeout_seconds=timeout_seconds,
    )


def generate_image(
    *,
    api_key: str,
    model: str,
    prompt_text: str,
    images: list[tuple[str, bytes]],
    use_image_config: bool,
    timeout_seconds: int,
) -> GeminiImageResult:
    prompt_text = _enhance_image_prompt(prompt_text)
    model_name = normalize_gemini_model_name(model)
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:generateContent"

    generation_config: dict[str, Any] = {
        "temperature": 0.2,
        "responseModalities": ["TEXT", "IMAGE"],
    }

    if use_image_config and images:
        dims = try_get_image_dimensions(images[0][1])
        if dims:
            width, height = dims
            aspect_ratio = choose_supported_aspect_ratio(width, height)
            image_size = choose_image_size_for_input(width, height)
            if aspect_ratio or image_size:
                generation_config["imageConfig"] = {
                    **({"aspectRatio": aspect_ratio} if aspect_ratio else {}),
                    **({"imageSize": image_size} if image_size else {}),
                }

    parts_in: list[dict[str, Any]] = [{"text": prompt_text}]
    for mime_type, data in images:
        parts_in.append(
            {
                "inlineData": {
                    "mimeType": mime_type,
                    "data": base64.b64encode(data).decode("utf-8"),
                }
            }
        )

    payload = {
        "contents": [{"role": "user", "parts": parts_in}],
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

    parts = (
        (((result.get("candidates") or [{}])[0]).get("content") or {}).get("parts")
        or []
    )

    for part in parts:
        inline = part.get("inline_data") or part.get("inlineData")
        if inline and inline.get("data"):
            mime_type = inline.get("mime_type") or inline.get("mimeType") or "image/png"
            return GeminiImageResult(mime_type=mime_type, image_base64=inline["data"])

    raise GeminiError("Gemini API did not return an image")
