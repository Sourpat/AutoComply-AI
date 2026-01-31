from __future__ import annotations

import hashlib
import json
from typing import Any, Dict


def _sorted_obj(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _sorted_obj(value[key]) for key in sorted(value)}
    if isinstance(value, list):
        return [_sorted_obj(item) for item in value]
    return value


def stable_dumps(payload: Any) -> str:
    return json.dumps(_sorted_obj(payload), separators=(",", ":"), ensure_ascii=False)


def canonicalize_packet(packet: Dict[str, Any]) -> Dict[str, Any]:
    packet_copy: Dict[str, Any] = dict(packet)
    packet_copy.pop("packetHash", None)
    packet_copy.pop("exportedAt", None)

    metadata = packet_copy.get("metadata")
    if isinstance(metadata, dict):
        metadata = dict(metadata)
        metadata.pop("generatedAt", None)
        metadata.pop("exportedAt", None)
        packet_copy["metadata"] = metadata

    return packet_copy


def compute_packet_hash(packet: Dict[str, Any]) -> str:
    canonical = canonicalize_packet(packet)
    encoded = stable_dumps(canonical).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()
