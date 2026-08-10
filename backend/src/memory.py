import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_DATABASE_PATH = "sahaya_memory.sqlite3"


def _connect() -> sqlite3.Connection:
    database_path = Path(os.getenv("SAHAYA_MEMORY_DB", DEFAULT_DATABASE_PATH))
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS caller_memory (
            user_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            language_preference TEXT,
            facts_json TEXT NOT NULL DEFAULT '{}',
            last_interaction TEXT NOT NULL
        )
        """
    )
    return connection


def lookup_caller(user_id: str) -> dict[str, Any] | None:
    with _connect() as connection:
        row = connection.execute(
            """
            SELECT user_id, name, language_preference, facts_json, last_interaction
            FROM caller_memory
            WHERE user_id = ?
            """,
            (user_id,),
        ).fetchone()

    if row is None:
        return None

    return {
        "user_id": row["user_id"],
        "name": row["name"],
        "language_preference": row["language_preference"],
        "facts": json.loads(row["facts_json"]),
        "last_interaction": row["last_interaction"],
    }


def save_caller(
    *,
    user_id: str,
    name: str,
    language_preference: str | None = None,
    facts: dict[str, Any] | None = None,
) -> dict[str, Any]:
    existing = lookup_caller(user_id)
    merged_facts = dict(existing["facts"]) if existing else {}
    merged_facts.update(facts or {})
    timestamp = datetime.now(timezone.utc).isoformat()

    with _connect() as connection:
        connection.execute(
            """
            INSERT INTO caller_memory (
                user_id,
                name,
                language_preference,
                facts_json,
                last_interaction
            )
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                name = excluded.name,
                language_preference = COALESCE(
                    excluded.language_preference,
                    caller_memory.language_preference
                ),
                facts_json = excluded.facts_json,
                last_interaction = excluded.last_interaction
            """,
            (
                user_id,
                name,
                language_preference,
                json.dumps(merged_facts, sort_keys=True),
                timestamp,
            ),
        )

    return {
        "user_id": user_id,
        "name": name,
        "language_preference": language_preference
        or (existing["language_preference"] if existing else None),
        "facts": merged_facts,
        "last_interaction": timestamp,
    }
