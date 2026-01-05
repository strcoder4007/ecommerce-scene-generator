from __future__ import annotations

import mimetypes
import uuid
from pathlib import Path


def default_storage_dir() -> Path:
    # backend/app/storage.py -> backend/
    backend_dir = Path(__file__).resolve().parents[1]
    return backend_dir / "storage"


def get_storage_dir() -> Path:
    import os

    raw = (os.environ.get("STORAGE_DIR") or "").strip()
    if raw:
        return Path(raw).expanduser().resolve()
    return default_storage_dir()


def safe_ext_from_upload(filename: str | None, mime_type: str | None) -> str:
    filename = (filename or "").strip()
    if filename and "." in filename:
        ext = "." + filename.rsplit(".", 1)[1].lower()
        if 1 < len(ext) <= 10:
            return ext

    mime_type = (mime_type or "").split(";")[0].strip().lower()
    if mime_type:
        guessed = mimetypes.guess_extension(mime_type) or ""
        if guessed and 1 < len(guessed) <= 10:
            return guessed

    return ".bin"


def write_bytes(*, relative_path: str, data: bytes) -> Path:
    root = get_storage_dir()
    full = (root / relative_path).resolve()
    if root not in full.parents and full != root:
        raise ValueError("Invalid storage path")
    full.parent.mkdir(parents=True, exist_ok=True)
    full.write_bytes(data)
    return full


def allocate_asset_path(*, asset_type: str, filename: str | None, mime_type: str | None) -> tuple[str, str]:
    asset_id = str(uuid.uuid4())
    ext = safe_ext_from_upload(filename, mime_type)
    rel = f"assets/{asset_type}s/{asset_id}{ext}"
    return asset_id, rel

