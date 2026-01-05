from __future__ import annotations

import base64
import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

from .gemini_vto import normalize_gemini_model_name


class GeminiTextError(RuntimeError):
    pass


@dataclass(frozen=True)
class GeminiTextResult:
    text: str
    raw: dict[str, Any]


def generate_text(
    *,
    api_key: str,
    model: str,
    prompt_text: str,
    images: list[tuple[str, bytes]] | None = None,
    timeout_seconds: int = 60,
    temperature: float = 0.2,
    max_output_tokens: int | None = None,
) -> GeminiTextResult:
    model_name = normalize_gemini_model_name(model)
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:generateContent"

    parts: list[dict[str, Any]] = [{"text": prompt_text}]
    for mime_type, data in images or []:
        parts.append(
            {
                "inlineData": {
                    "mimeType": mime_type,
                    "data": base64.b64encode(data).decode("utf-8"),
                }
            }
        )

    generation_config: dict[str, Any] = {"temperature": temperature}
    if max_output_tokens is not None:
        generation_config["maxOutputTokens"] = max_output_tokens

    payload = {
        "contents": [{"role": "user", "parts": parts}],
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
        raise GeminiTextError(f"Gemini API request failed: {exc}") from exc

    if status_code != 200:
        body_excerpt = raw_body[:500].decode("utf-8", errors="replace") if raw_body else ""
        raise GeminiTextError(f"Gemini API error ({status_code}): {body_excerpt}")

    try:
        result = json.loads(raw_body.decode("utf-8"))
    except Exception as exc:
        raise GeminiTextError(
            f"Gemini API returned non-JSON response (Content-Type: {content_type})"
        ) from exc

    parts_out = (
        (((result.get("candidates") or [{}])[0]).get("content") or {}).get("parts")
        or []
    )
    text_chunks: list[str] = []
    for part in parts_out:
        if isinstance(part, dict) and part.get("text"):
            text_chunks.append(str(part["text"]))
    text = "\n".join(text_chunks).strip()
    if not text:
        raise GeminiTextError("Gemini API did not return text")

    return GeminiTextResult(text=text, raw=result)

