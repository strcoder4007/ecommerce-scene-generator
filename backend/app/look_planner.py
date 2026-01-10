from __future__ import annotations

import json
import random
from dataclasses import dataclass

from .db import AssetRecord
from .gemini_text import GeminiTextError, generate_text


class LookPlanError(RuntimeError):
    pass


def _extract_json_object(text: str) -> dict:
    text = text.strip()
    if not text:
        raise ValueError("Empty response")

    # Strip code fences if present.
    if "```" in text:
        chunks: list[str] = []
        in_fence = False
        for line in text.splitlines():
            if line.strip().startswith("```"):
                in_fence = not in_fence
                continue
            if in_fence:
                chunks.append(line)
        candidate = "\n".join(chunks).strip()
        if candidate:
            text = candidate

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found")
    return json.loads(text[start : end + 1])


def _coerce_str(v: object | None) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _coerce_str_list(v: object | None) -> list[str]:
    if v is None:
        return []
    if isinstance(v, list):
        out: list[str] = []
        for item in v:
            s = _coerce_str(item)
            if s:
                out.append(s)
        return out
    if isinstance(v, str):
        parts = [p.strip() for p in v.replace(";", ",").split(",")]
        return [p for p in parts if p]
    return []


@dataclass(frozen=True)
class LookPlan:
    occasion: str
    color_scheme: str
    print_style: str
    style_keywords: list[str]
    background_theme: str
    accessories: list[str]
    negative_prompt: str
    model_ethnicity: str
    model_styling_notes: str


@dataclass(frozen=True)
class LookOverrides:
    occasion: str | None = None
    color_scheme: str | None = None
    print_style: str | None = None
    background_theme: str | None = None
    model_ethnicity: str | None = None
    model_styling_notes: str | None = None

    def to_prompt_lines(self) -> list[str]:
        lines: list[str] = []
        for key, val in [
            ("occasion", self.occasion),
            ("color_scheme", self.color_scheme),
            ("print_style", self.print_style),
            ("background_theme", self.background_theme),
            ("model_ethnicity", self.model_ethnicity),
            ("model_styling_notes", self.model_styling_notes),
        ]:
            v = (val or "").strip()
            if v:
                lines.append(f"- {key}: {v}")
        return lines


def plan_look_from_garment(
    *,
    api_key: str,
    model: str,
    garment_bytes: bytes,
    garment_mime_type: str,
    available_background_themes: list[str],
    available_model_ethnicities: list[str],
    user_overrides: LookOverrides,
    timeout_seconds: int,
) -> LookPlan:
    # Provide constraint hints but don't force exact matches (fallback handled later).
    bg_hint = ", ".join(available_background_themes[:20]) if available_background_themes else "(none available)"
    eth_hint = ", ".join(available_model_ethnicities[:20]) if available_model_ethnicities else "(none available)"

    override_lines = user_overrides.to_prompt_lines()
    overrides_block = "\n".join(override_lines) if override_lines else "- (none)"

    prompt = f"""
You are a senior fashion ecommerce creative director for product photography.
The input is a GARMENT PHOTO (usually a single garment on a mannequin). There is no real person in the input.

Goal: propose a styling plan to generate a photorealistic, high-conversion ecommerce product image:
- A single model wearing EXACTLY the same garment from the GARMENT PHOTO.
- Be creative in the scene + styling while keeping it commercially usable and product-first.

Hard rules:
- Output ONLY valid JSON (no markdown, no commentary).
- Keep the garment design accurate: do NOT invent or change neckline, sleeves, hem, print/pattern, logos/graphics, or fabric texture.
- Do not hallucinate specific garment details you cannot see; when uncertain, use "as-is".

If the user provided overrides, respect them:
{overrides_block}

Background themes available (if you can match one, do so): {bg_hint}
Model ethnicities available (if you can match one, do so): {eth_hint}

Return JSON with exactly these keys:
{{
  "occasion": string (examples: "beachwear", "party", "evening", "casual"),
  "color_scheme": string (short; for the overall scene palette; must NOT imply recoloring the garment),
  "print_style": string (short; describe the garment print if visible, otherwise "as-is"),
  "style_keywords": array of strings (3-8 items, short),
  "background_theme": string,
  "accessories": array of strings (0-6 items; realistic),
  "negative_prompt": string (short avoid clause),
  "model_ethnicity": string,
  "model_styling_notes": string (short; hair/makeup/jewelry guidance)
}}
""".strip()

    try:
        result = generate_text(
            api_key=api_key,
            model=model,
            prompt_text=prompt,
            images=[(garment_mime_type, garment_bytes)],
            timeout_seconds=timeout_seconds,
            temperature=0.2,
            max_output_tokens=512,
        )
        data = _extract_json_object(result.text)
    except (GeminiTextError, Exception) as exc:
        raise LookPlanError(f"Failed to plan look: {exc}") from exc

    # Apply overrides last to guarantee they win.
    occasion = _coerce_str(user_overrides.occasion) or _coerce_str(data.get("occasion")) or "casual"
    color_scheme = _coerce_str(user_overrides.color_scheme) or _coerce_str(data.get("color_scheme")) or "neutral"
    print_style = _coerce_str(user_overrides.print_style) or _coerce_str(data.get("print_style")) or "as-is"
    style_keywords = _coerce_str_list(data.get("style_keywords"))
    background_theme = _coerce_str(user_overrides.background_theme) or _coerce_str(data.get("background_theme")) or occasion
    accessories = _coerce_str_list(data.get("accessories"))
    negative_prompt = (
        _coerce_str(data.get("negative_prompt"))
        or "blurry, low quality, incorrect garment, altered design, wrong print, extra limbs, deformed hands, text overlay, watermark"
    )
    model_ethnicity = _coerce_str(user_overrides.model_ethnicity) or _coerce_str(data.get("model_ethnicity")) or ""
    model_styling_notes = _coerce_str(user_overrides.model_styling_notes) or _coerce_str(data.get("model_styling_notes")) or ""

    return LookPlan(
        occasion=occasion,
        color_scheme=color_scheme,
        print_style=print_style,
        style_keywords=style_keywords,
        background_theme=background_theme,
        accessories=accessories,
        negative_prompt=negative_prompt,
        model_ethnicity=model_ethnicity,
        model_styling_notes=model_styling_notes,
    )


def choose_background(backgrounds: list[AssetRecord], desired_theme: str) -> AssetRecord | None:
    if not backgrounds:
        return None
    desired = (desired_theme or "").strip().lower()
    themed = [b for b in backgrounds if (b.theme or "").strip().lower() == desired] if desired else []
    return random.choice(themed) if themed else backgrounds[0]


def choose_model(models: list[AssetRecord], desired_ethnicity: str) -> AssetRecord | None:
    if not models:
        return None
    desired = (desired_ethnicity or "").strip().lower()
    matched = [m for m in models if (m.ethnicity or "").strip().lower() == desired] if desired else []
    return random.choice(matched) if matched else models[0]


def generate_final_prompt(
    *,
    api_key: str,
    model: str,
    plan: LookPlan,
    background: AssetRecord | None,
    chosen_model: AssetRecord | None,
    has_background_reference: bool,
    has_model_reference: bool,
    timeout_seconds: int,
) -> str:
    background_desc = (
        f"{background.title} (theme: {background.theme or 'n/a'}, tags: {', '.join(background.tags)})"
        if background
        else "a relevant fashion background"
    )
    model_desc = (
        f"{chosen_model.title} (ethnicity: {chosen_model.ethnicity or 'n/a'}, tags: {', '.join(chosen_model.tags)})"
        if chosen_model
        else "a suitable female fashion model"
    )

    background_instruction = (
        "Use the BACKGROUND PHOTO as the setting."
        if has_background_reference
        else f"No background reference is provided; invent a photorealistic setting matching: {plan.background_theme or plan.occasion}."
    )
    model_instruction = (
        "Use the MODEL PHOTO as identity/pose reference."
        if has_model_reference
        else (
            "No model reference is provided; invent a suitable female fashion model."
            + (f" Prefer ethnicity: {plan.model_ethnicity}." if plan.model_ethnicity else "")
        )
    )

    prompt = f"""
You write prompts for a photorealistic fashion image model that generates ecommerce product photos.
Write ONE concise prompt to generate a high-quality, product-first ecommerce image.

Constraints:
- The output image must show a single female model wearing EXACTLY the garment from the GARMENT REFERENCE image (the garment may be photographed on a mannequin; ignore the mannequin).
- {background_instruction} (match: {background_desc}).
- {model_instruction} (match: {model_desc}).
- Keep anatomy correct, no extra limbs, no blur, no duplicated people.
- Do not add any new text/watermarks/logos (especially in the background). Preserve garment design from the reference (do not invent extra straps, patterns, or recolor it).

Styling plan:
- occasion: {plan.occasion}
- color_scheme: {plan.color_scheme}
- print_style: {plan.print_style}
- style_keywords: {", ".join(plan.style_keywords) if plan.style_keywords else "(none)"}
- accessories: {", ".join(plan.accessories) if plan.accessories else "(none)"}
- model_styling_notes: {plan.model_styling_notes or "(none)"}

Negative guidance to incorporate (as a short avoid clause): {plan.negative_prompt}

Return ONLY the prompt text (no quotes, no JSON).
""".strip()

    try:
        result = generate_text(
            api_key=api_key,
            model=model,
            prompt_text=prompt,
            images=None,
            timeout_seconds=timeout_seconds,
            temperature=0.2,
            max_output_tokens=400,
        )
    except GeminiTextError as exc:
        # Fallback to a deterministic template if the LLM fails.
        avoid = plan.negative_prompt or "blurry, low quality, extra limbs, text"
        background_clause = (
            "set in the BACKGROUND PHOTO"
            if has_background_reference
            else f"set in a photorealistic {plan.background_theme or plan.occasion} background"
        )
        model_clause = (
            "one female model"
            if has_model_reference
            else (
                "one female model"
                + (f" (prefer {plan.model_ethnicity})" if plan.model_ethnicity else "")
            )
        )
        return (
            f"Photorealistic ecommerce fashion photo, {model_clause} wearing the garment from the GARMENT PHOTO, "
            f"{plan.occasion} style, {plan.color_scheme} color palette, garment print as in reference ({plan.print_style}), "
            f"accessories: {', '.join(plan.accessories) if plan.accessories else 'none'}, "
            f"{background_clause}, natural lighting, realistic fabric drape, avoid: {avoid}."
        )

    return result.text.strip()
