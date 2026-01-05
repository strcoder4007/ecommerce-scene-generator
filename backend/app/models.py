from __future__ import annotations

from pydantic import BaseModel


class AssetOut(BaseModel):
    id: str
    title: str
    theme: str | None = None
    ethnicity: str | None = None
    tags: list[str] = []
    image_url: str
    created_at: str


class GenerateLookResponse(BaseModel):
    mime_type: str
    image_base64: str
    chosen: dict
    debug: dict | None = None

