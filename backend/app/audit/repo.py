from __future__ import annotations

from typing import Any, Dict, Optional

from src.core.db import get_raw_connection, row_to_dict


def init_audit_schema() -> None:
    schema_sql = """
    CREATE TABLE IF NOT EXISTS audit_packets (
        packet_hash TEXT PRIMARY KEY NOT NULL,
        case_id TEXT NOT NULL,
        decision_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        packet_version TEXT NOT NULL DEFAULT 'v1',
        packet_json TEXT NOT NULL,
        size_bytes INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_packets_case_id ON audit_packets(case_id);
    CREATE INDEX IF NOT EXISTS idx_audit_packets_decision_id ON audit_packets(decision_id);
    CREATE INDEX IF NOT EXISTS idx_audit_packets_created_at ON audit_packets(created_at);
    """

    with get_raw_connection() as conn:
        conn.executescript(schema_sql)


def upsert_audit_packet(payload: Dict[str, Any]) -> Dict[str, Any]:
    with get_raw_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO audit_packets (
                packet_hash,
                case_id,
                decision_id,
                created_at,
                packet_version,
                packet_json,
                size_bytes
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(packet_hash)
            DO UPDATE SET
                case_id = excluded.case_id,
                decision_id = excluded.decision_id,
                created_at = excluded.created_at,
                packet_version = excluded.packet_version,
                packet_json = excluded.packet_json,
                size_bytes = excluded.size_bytes
            """,
            (
                payload["packet_hash"],
                payload["case_id"],
                payload["decision_id"],
                payload["created_at"],
                payload.get("packet_version", "v1"),
                payload["packet_json"],
                payload["size_bytes"],
            ),
        )
        conn.commit()
        cursor.execute("SELECT * FROM audit_packets WHERE packet_hash = ?", (payload["packet_hash"],))
        row = cursor.fetchone()
        cursor.close()

    return row_to_dict(row) if row else payload


def get_audit_packet(packet_hash: str) -> Optional[Dict[str, Any]]:
    with get_raw_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM audit_packets WHERE packet_hash = ?", (packet_hash,))
        row = cursor.fetchone()
        cursor.close()

    return row_to_dict(row) if row else None
