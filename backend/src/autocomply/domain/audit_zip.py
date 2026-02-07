from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Dict, List, Tuple
from zipfile import ZIP_DEFLATED, ZipFile

from src.autocomply.domain.attachments_store import get_attachment


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _sanitize_filename(filename: str) -> str:
    base = os.path.basename(filename or "")
    base = base.replace("/", "_").replace("\\", "_")
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._-")
    if not base:
        base = "file"
    if len(base) > 80:
        base = base[:80]
    return base


def _attachment_id_from_record(record: Dict[str, Any]) -> str:
    return str(record.get("id") or record.get("attachment_id") or "").strip()


def build_audit_manifest_and_files(
    packet: Dict[str, Any],
    *,
    case_id: str,
    submission_id: str | None,
    locked: bool,
) -> Tuple[Dict[str, Any], bytes, List[Tuple[str, bytes]]]:
    packet_bytes = json.dumps(packet, indent=2).encode("utf-8")
    packet_sha256 = _sha256_bytes(packet_bytes)

    attachments = list((packet.get("evidence") or {}).get("attachments") or [])
    files: List[Dict[str, Any]] = []
    evidence_payloads: List[Tuple[str, bytes]] = []

    for index, attachment in enumerate(attachments, start=1):
        attachment_id = _attachment_id_from_record(attachment)
        if not attachment_id:
            raise ValueError("Attachment id missing in packet evidence")

        record, file_path = get_attachment(attachment_id)
        file_bytes = file_path.read_bytes()
        file_sha256 = _sha256_bytes(file_bytes)

        filename = attachment.get("filename") or record.get("filename") or "file"
        safe_name = _sanitize_filename(filename)
        evidence_path = f"evidence/{index:02d}_{attachment_id}_{safe_name}"

        byte_size = (
            attachment.get("size")
            or attachment.get("byte_size")
            or record.get("byte_size")
            or len(file_bytes)
        )
        content_type = attachment.get("content_type") or record.get("content_type")

        files.append(
            {
                "attachment_id": attachment_id,
                "path": evidence_path,
                "sha256": file_sha256,
                "byte_size": int(byte_size),
                "content_type": content_type,
            }
        )
        evidence_payloads.append((evidence_path, file_bytes))

    generated_at = (
        (packet.get("verifier") or {}).get("generated_at")
        or (packet.get("finalization") or {}).get("generated_at")
        or _now_iso()
    )

    manifest = {
        "case_id": case_id,
        "submission_id": submission_id,
        "locked": bool(locked),
        "packet_version": packet.get("packet_version"),
        "packet_sha256": packet_sha256,
        "generated_at": generated_at,
        "files": files,
    }

    return manifest, packet_bytes, evidence_payloads


def build_audit_zip_bundle(
    packet: Dict[str, Any],
    *,
    case_id: str,
    submission_id: str | None,
    locked: bool,
) -> Tuple[bytes, Dict[str, Any]]:
    manifest, packet_bytes, evidence_payloads = build_audit_manifest_and_files(
        packet,
        case_id=case_id,
        submission_id=submission_id,
        locked=locked,
    )

    manifest_bytes = json.dumps(manifest, indent=2).encode("utf-8")

    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("decision_packet.json", packet_bytes)
        archive.writestr("manifest.json", manifest_bytes)
        for path, payload in evidence_payloads:
            archive.writestr(path, payload)

    return buffer.getvalue(), manifest
