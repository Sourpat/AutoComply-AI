"""
Phase 7.31: Advanced PII Scanner
Deterministic PII detection with JSONPath-like tracking for audit exports.

Author: AutoComply AI
Date: 2026-01-20
"""

import re
from typing import Any, List, Dict, Optional


class PIIFinding:
    """Represents a detected PII instance."""
    
    def __init__(self, path: str, field_name: str, rule: str, value_preview: str, confidence: str = "high"):
        self.path = path  # JSONPath-like: "history[0].intelligence_payload.patient_name"
        self.field_name = field_name
        self.rule = rule  # email, phone, ssn, license, dea, name, address
        self.value_preview = value_preview  # First 20 chars for logging
        self.confidence = confidence  # high, medium, low
    
    def to_dict(self) -> Dict[str, str]:
        return {
            "path": self.path,
            "field_name": self.field_name,
            "rule": self.rule,
            "value_preview": self.value_preview,
            "confidence": self.confidence
        }


# PII Detection Patterns
PATTERNS = {
    "email": re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
    "phone": re.compile(r'(\d{3}[-.\s]\d{3,4}(?:[-.\s]\d{4})?|\d{7}|\d{10})'),  # 7 or 10 digit phones
    "ssn": re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
    "dea": re.compile(r'\b(DEA|dea)[-:]?[A-Z0-9]{9,}\b'),
    "license": re.compile(r'\b(LICENSE|LIC|license)[-:]?[A-Z0-9]{5,}\b'),
    "zip": re.compile(r'\b\d{5}(-\d{4})?\b'),
}

# Field names that likely contain PII (case-insensitive)
SENSITIVE_FIELD_NAMES = {
    # Names
    "name", "patient_name", "practitioner_name", "full_name", "first_name", "last_name",
    "provider_name", "physician_name", "doctor_name", "contact_name",
    
    # Contact info
    "email", "phone", "telephone", "mobile", "fax", "contact",
    
    # Addresses
    "address", "street", "city", "state", "zip", "zipcode", "postal_code",
    "billing_address", "shipping_address", "mailing_address",
    
    # IDs
    "ssn", "social_security", "dea", "npi", "license_number", "license_id",
    "patient_id", "practitioner_id", "provider_id",
    
    # Other PII
    "dob", "birth_date", "birthdate", "date_of_birth",
    "signature", "notes", "comments", "remarks"
}


def detect_pii(data: Any, path: str = "$", findings: Optional[List[PIIFinding]] = None) -> List[PIIFinding]:
    """
    Recursively scan data structure for PII patterns.
    
    Args:
        data: Dictionary, list, or primitive value to scan
        path: JSONPath-like location (e.g., "$.history[0].payload.name")
        findings: Accumulated findings list
        
    Returns:
        List of PIIFinding objects
        
    Examples:
        >>> data = {"email": "john@example.com", "nested": {"phone": "555-1234"}}
        >>> findings = detect_pii(data)
        >>> len(findings)
        2
        >>> findings[0].rule
        'email'
    """
    if findings is None:
        findings = []
    
    if isinstance(data, dict):
        for key, value in data.items():
            # Build JSONPath-like key
            current_path = f"{path}.{key}" if path != "$" else f"$.{key}"
            
            # Check if field name is sensitive
            if key.lower() in SENSITIVE_FIELD_NAMES:
                if isinstance(value, str) and value.strip():
                    findings.append(PIIFinding(
                        path=current_path,
                        field_name=key,
                        rule="sensitive_field_name",
                        value_preview=str(value)[:20],
                        confidence="medium"
                    ))
            
            # Recurse into nested structures
            detect_pii(value, current_path, findings)
            
    elif isinstance(data, list):
        for idx, item in enumerate(data):
            current_path = f"{path}[{idx}]"
            detect_pii(item, current_path, findings)
            
    elif isinstance(data, str):
        # Scan string for PII patterns
        _scan_string_patterns(data, path, findings)
    
    return findings


def _scan_string_patterns(text: str, path: str, findings: List[PIIFinding]):
    """Scan a string for PII patterns and add findings."""
    if not text or not text.strip():
        return
    
    # Check each pattern
    for rule_name, pattern in PATTERNS.items():
        matches = pattern.findall(text)
        if matches:
            # Get first match for preview
            match = matches[0] if isinstance(matches[0], str) else matches[0][0]
            findings.append(PIIFinding(
                path=path,
                field_name=path.split(".")[-1].split("[")[0],  # Extract field name
                rule=rule_name,
                value_preview=str(match)[:20],
                confidence="high"
            ))


def count_findings_by_rule(findings: List[PIIFinding]) -> Dict[str, int]:
    """
    Count findings grouped by rule type.
    
    Returns:
        Dictionary mapping rule name to count
        
    Example:
        >>> findings = [PIIFinding(..., rule="email", ...), PIIFinding(..., rule="email", ...)]
        >>> count_findings_by_rule(findings)
        {'email': 2}
    """
    counts = {}
    for finding in findings:
        counts[finding.rule] = counts.get(finding.rule, 0) + 1
    return counts


def generate_findings_sample(findings: List[PIIFinding], max_items: int = 20) -> List[Dict[str, str]]:
    """
    Generate a sample of findings for reporting.
    
    Args:
        findings: List of all findings
        max_items: Maximum items to include in sample
        
    Returns:
        List of finding dictionaries (truncated to max_items)
    """
    # Take first max_items findings
    sample = findings[:max_items]
    return [f.to_dict() for f in sample]


def get_unique_paths(findings: List[PIIFinding]) -> List[str]:
    """
    Get list of unique JSONPath locations where PII was found.
    
    Returns:
        Sorted list of unique paths
    """
    paths = set(f.path for f in findings)
    return sorted(paths)
