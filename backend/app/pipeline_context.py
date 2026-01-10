from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .db import AssetRecord
from .gemini_vto import GeminiImageResult
from .look_planner import LookOverrides, LookPlan


@dataclass(frozen=True)
class GenerateLookUserOptions:
    background_id: str | None
    model_id: str | None
    overrides: LookOverrides
    style_keywords: str | None
    accessories: str | None
    include_debug: bool


@dataclass
class PipelineContext:
    request_id: str
    garment_mime_type: str
    garment_bytes: bytes
    options: GenerateLookUserOptions

    backgrounds: list[AssetRecord] = field(default_factory=list)
    models: list[AssetRecord] = field(default_factory=list)

    plan: LookPlan | None = None
    plan_error: str | None = None

    chosen_background: AssetRecord | None = None
    chosen_model: AssetRecord | None = None
    background_bytes: bytes | None = None
    model_bytes: bytes | None = None

    garment_design_prompt: str | None = None
    styled_garment: GeminiImageResult | None = None
    styled_garment_bytes: bytes | None = None

    final_prompt: str | None = None
    composite_prompt: str | None = None
    images_for_composite: list[tuple[str, bytes]] = field(default_factory=list)

    result: GeminiImageResult | None = None

    timings: dict[str, float] = field(default_factory=dict)
    debug: dict[str, Any] = field(default_factory=dict)
