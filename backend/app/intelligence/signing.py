"""
Phase 7.26: Cryptographic Signing for Audit Export
HMAC-SHA256 signing utilities for tamper-proof audit trails.

Provides:
- canonical_json: Deterministic JSON serialization for signing
- hmac_sign: Generate HMAC-SHA256 signature
- hmac_verify: Verify HMAC-SHA256 signature

Author: AutoComply AI
Date: 2026-01-20
"""

import hmac
import hashlib
import json
from typing import Any, Dict


def canonical_json(obj: Any) -> bytes:
    """
    Serialize object to canonical JSON bytes for signing.
    
    Ensures deterministic serialization by:
    - Sorting all dictionary keys
    - Using compact format (no whitespace)
    - UTF-8 encoding
    
    Args:
        obj: Python object to serialize (dict, list, primitives)
        
    Returns:
        UTF-8 encoded JSON bytes
        
    Example:
        >>> canonical_json({"b": 2, "a": 1})
        b'{"a":1,"b":2}'
    """
    json_str = json.dumps(
        obj,
        sort_keys=True,
        separators=(',', ':'),
        ensure_ascii=False,
        default=str  # Handle non-serializable objects (dates, etc.)
    )
    return json_str.encode('utf-8')


def hmac_sign(payload_bytes: bytes, secret: str) -> str:
    """
    Generate HMAC-SHA256 signature for payload.
    
    Args:
        payload_bytes: Canonical JSON bytes to sign
        secret: Secret key for HMAC signing
        
    Returns:
        Hex-encoded signature string
        
    Example:
        >>> payload = b'{"case_id":"abc-123"}'
        >>> hmac_sign(payload, "my-secret-key")
        'a1b2c3d4e5f6...'
    """
    signature = hmac.new(
        secret.encode('utf-8'),
        payload_bytes,
        hashlib.sha256
    )
    return signature.hexdigest()


def hmac_verify(payload_bytes: bytes, secret: str, signature_hex: str) -> bool:
    """
    Verify HMAC-SHA256 signature for payload.
    
    Args:
        payload_bytes: Canonical JSON bytes that were signed
        secret: Secret key for HMAC verification
        signature_hex: Hex-encoded signature to verify
        
    Returns:
        True if signature is valid, False otherwise
        
    Example:
        >>> payload = b'{"case_id":"abc-123"}'
        >>> sig = hmac_sign(payload, "my-secret-key")
        >>> hmac_verify(payload, "my-secret-key", sig)
        True
        >>> hmac_verify(payload, "wrong-key", sig)
        False
    """
    expected_signature = hmac_sign(payload_bytes, secret)
    return hmac.compare_digest(signature_hex, expected_signature)


def sign_audit_export(export_data: Dict[str, Any], secret: str, key_id: str = "k1") -> Dict[str, Any]:
    """
    Sign an audit export payload and add signature metadata.
    
    The signature is computed over the export data WITHOUT the signature field itself.
    This allows verification by extracting the signature, removing it, and recomputing.
    
    Args:
        export_data: The complete export payload (metadata, integrity_check, history, etc.)
        secret: HMAC secret key
        key_id: Key identifier for key rotation (default: "k1")
        
    Returns:
        Export data with added 'signature' and 'canonicalization' fields
        
    Example:
        >>> export = {"metadata": {...}, "history": [...]}
        >>> signed = sign_audit_export(export, "secret", "k1")
        >>> 'signature' in signed
        True
    """
    from datetime import datetime
    
    # Compute signature over export data (without signature field)
    payload_to_sign = {k: v for k, v in export_data.items() if k not in ['signature', 'canonicalization']}
    payload_bytes = canonical_json(payload_to_sign)
    signature_value = hmac_sign(payload_bytes, secret)
    
    # Add signature metadata
    signed_data = export_data.copy()
    signed_data['signature'] = {
        'alg': 'HMAC-SHA256',
        'key_id': key_id,
        'value': signature_value,
        'signed_at': datetime.utcnow().isoformat() + 'Z'
    }
    signed_data['canonicalization'] = {
        'json': 'sorted_keys_compact',
        'exclude_fields': ['signature', 'canonicalization']
    }
    
    return signed_data


def verify_audit_export(signed_export: Dict[str, Any], secret: str) -> Dict[str, Any]:
    """
    Verify the signature of a signed audit export.
    
    Args:
        signed_export: Export data with 'signature' field
        secret: HMAC secret key
        
    Returns:
        Verification result dict:
        - signature_valid: bool (True if signature matches)
        - key_id: str (Key identifier used)
        - algorithm: str (Signing algorithm)
        - signed_at: str (Timestamp of signature)
        - errors: list (Error messages if invalid)
        
    Example:
        >>> signed = sign_audit_export(export_data, "secret")
        >>> verify_audit_export(signed, "secret")
        {'signature_valid': True, 'key_id': 'k1', ...}
    """
    errors = []
    
    # Extract signature metadata
    signature_meta = signed_export.get('signature')
    if not signature_meta:
        return {
            'signature_valid': False,
            'errors': ['No signature found in export']
        }
    
    signature_value = signature_meta.get('value')
    key_id = signature_meta.get('key_id', 'unknown')
    algorithm = signature_meta.get('alg', 'unknown')
    signed_at = signature_meta.get('signed_at', 'unknown')
    
    # Verify algorithm
    if algorithm != 'HMAC-SHA256':
        errors.append(f"Unsupported algorithm: {algorithm}")
        return {
            'signature_valid': False,
            'key_id': key_id,
            'algorithm': algorithm,
            'signed_at': signed_at,
            'errors': errors
        }
    
    # Reconstruct payload without signature fields
    payload_to_verify = {k: v for k, v in signed_export.items() if k not in ['signature', 'canonicalization']}
    payload_bytes = canonical_json(payload_to_verify)
    
    # Verify signature
    is_valid = hmac_verify(payload_bytes, secret, signature_value)
    
    if not is_valid:
        errors.append('Signature verification failed - payload may have been tampered with')
    
    return {
        'signature_valid': is_valid,
        'key_id': key_id,
        'algorithm': algorithm,
        'signed_at': signed_at,
        'errors': errors if errors else []
    }
