from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


@dataclass(frozen=True)
class AssetRecord:
    id: str
    asset_type: str  # "background" | "model"
    title: str
    theme: str | None
    ethnicity: str | None
    tags: list[str]
    file_path: str
    mime_type: str
    created_at: str


class AppDb:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def init(self) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS assets (
                  id TEXT PRIMARY KEY,
                  asset_type TEXT NOT NULL,
                  title TEXT NOT NULL,
                  theme TEXT NULL,
                  ethnicity TEXT NULL,
                  tags_json TEXT NOT NULL,
                  file_path TEXT NOT NULL,
                  mime_type TEXT NOT NULL,
                  created_at TEXT NOT NULL
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type)"
            )

    def insert_asset(
        self,
        *,
        asset_id: str,
        asset_type: str,
        title: str,
        theme: str | None,
        ethnicity: str | None,
        tags: list[str],
        file_path: str,
        mime_type: str,
    ) -> AssetRecord:
        created_at = utc_now_iso()
        tags_json = json.dumps(tags, ensure_ascii=False)

        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO assets (
                  id, asset_type, title, theme, ethnicity, tags_json, file_path, mime_type, created_at
                ) VALUES (
                  ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
                """,
                (
                    asset_id,
                    asset_type,
                    title,
                    theme,
                    ethnicity,
                    tags_json,
                    file_path,
                    mime_type,
                    created_at,
                ),
            )

        return AssetRecord(
            id=asset_id,
            asset_type=asset_type,
            title=title,
            theme=theme,
            ethnicity=ethnicity,
            tags=tags,
            file_path=file_path,
            mime_type=mime_type,
            created_at=created_at,
        )

    def list_assets(self, *, asset_type: str) -> list[AssetRecord]:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM assets WHERE asset_type = ? ORDER BY created_at DESC",
                (asset_type,),
            ).fetchall()

        assets: list[AssetRecord] = []
        for row in rows:
            tags = json.loads(row["tags_json"] or "[]")
            assets.append(
                AssetRecord(
                    id=row["id"],
                    asset_type=row["asset_type"],
                    title=row["title"],
                    theme=row["theme"],
                    ethnicity=row["ethnicity"],
                    tags=tags,
                    file_path=row["file_path"],
                    mime_type=row["mime_type"],
                    created_at=row["created_at"],
                )
            )
        return assets

    def get_asset(self, *, asset_type: str, asset_id: str) -> AssetRecord | None:
        with self.connect() as conn:
            row = conn.execute(
                "SELECT * FROM assets WHERE asset_type = ? AND id = ? LIMIT 1",
                (asset_type, asset_id),
            ).fetchone()
        if not row:
            return None
        tags = json.loads(row["tags_json"] or "[]")
        return AssetRecord(
            id=row["id"],
            asset_type=row["asset_type"],
            title=row["title"],
            theme=row["theme"],
            ethnicity=row["ethnicity"],
            tags=tags,
            file_path=row["file_path"],
            mime_type=row["mime_type"],
            created_at=row["created_at"],
        )

