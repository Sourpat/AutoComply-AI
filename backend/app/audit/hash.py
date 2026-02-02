from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Tuple


def _sorted_obj(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _sorted_obj(value[key]) for key in sorted(value)}
    if isinstance(value, list):
        return [_sorted_obj(item) for item in value]
    if isinstance(value, datetime):
        return value.astimezone().isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def stable_dumps(payload: Any) -> str:
    return json.dumps(_sorted_obj(payload), separators=(",", ":"), ensure_ascii=False)


def canonicalize_packet(packet: Dict[str, Any]) -> Dict[str, Any]:
    packet_copy: Dict[str, Any] = dict(packet)
    packet_copy.pop("packetHash", None)
    packet_copy.pop("packet_hash", None)
    packet_copy.pop("packetSignature", None)
    packet_copy.pop("packet_signature", None)
    packet_copy.pop("signatureAlg", None)
    packet_copy.pop("signature_alg", None)
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


def compute_packet_signature(packet: Dict[str, Any], signing_key: str) -> str:
    canonical = canonicalize_packet(packet)
    encoded = stable_dumps(canonical).encode("utf-8")
    return hmac.new(signing_key.encode("utf-8"), encoded, hashlib.sha256).hexdigest()


def sign_packet(packet: Dict[str, Any], signing_key: str) -> Tuple[str, str]:
    packet_hash = compute_packet_hash(packet)
    signature = compute_packet_signature(packet, signing_key)
    return packet_hash, signature
