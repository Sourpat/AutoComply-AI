"""
Signal Expectations - Expected signals per decision type (PHASE 7.2)

Defines what signals are expected for each decision type to enable gap detection.
Used by gap detection and confidence scoring systems.
"""

from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class SignalExpectation:
    """Expected signal specification."""
    signal_type: str
    required: bool = True  # Must be present for high confidence
    min_strength: float = 0.5  # Minimum signal_strength threshold
    max_age_hours: Optional[int] = None  # Max age in hours before considered stale


# ============================================================================
# Expected Signals by Decision Type
# ============================================================================

# Core signals expected for ALL decision types
CORE_EXPECTED_SIGNALS = [
    SignalExpectation("submission_present", required=True, min_strength=1.0),
    SignalExpectation("submission_completeness", required=True, min_strength=0.5),
]

# CSF Practitioner (Controlled Substance Facility - Practitioner)
CSF_PRACTITIONER_SIGNALS = CORE_EXPECTED_SIGNALS + [
    SignalExpectation("evidence_present", required=True, min_strength=1.0),
    SignalExpectation("explainability_available", required=False, min_strength=1.0),
    SignalExpectation("request_info_open", required=False, min_strength=0.0),  # Should be closed
    SignalExpectation("submitter_responded", required=False, min_strength=1.0),
]

# CSF Facility
CSF_FACILITY_SIGNALS = CORE_EXPECTED_SIGNALS + [
    SignalExpectation("evidence_present", required=True, min_strength=1.0),
    SignalExpectation("explainability_available", required=False, min_strength=1.0),
]

# CSA (Controlled Substance Application)
CSA_SIGNALS = CORE_EXPECTED_SIGNALS + [
    SignalExpectation("evidence_present", required=True, min_strength=1.0),
    SignalExpectation("explainability_available", required=False, min_strength=1.0),
]

# License Renewal
LICENSE_RENEWAL_SIGNALS = CORE_EXPECTED_SIGNALS + [
    SignalExpectation("evidence_present", required=True, min_strength=1.0),
]

# Export Permit
EXPORT_PERMIT_SIGNALS = CORE_EXPECTED_SIGNALS + [
    SignalExpectation("evidence_present", required=True, min_strength=1.0),
    SignalExpectation("explainability_available", required=False, min_strength=1.0),
]

# Default for unknown decision types
DEFAULT_SIGNALS = CORE_EXPECTED_SIGNALS + [
    SignalExpectation("evidence_present", required=False, min_strength=1.0),
]


# Main mapping
EXPECTED_SIGNALS_BY_DECISION_TYPE: Dict[str, List[SignalExpectation]] = {
    "csf": CSF_PRACTITIONER_SIGNALS,
    "csf_practitioner": CSF_PRACTITIONER_SIGNALS,
    "csf_facility": CSF_FACILITY_SIGNALS,
    "csa": CSA_SIGNALS,
    "license_renewal": LICENSE_RENEWAL_SIGNALS,
    "export_permit": EXPORT_PERMIT_SIGNALS,
}


# ============================================================================
# Helper Functions
# ============================================================================

def get_expected_signals(decision_type: str) -> List[SignalExpectation]:
    """
    Get expected signals for a decision type.
    
    Args:
        decision_type: Decision type key
        
    Returns:
        List of SignalExpectation objects
        
    Example:
        >>> expectations = get_expected_signals("csf")
        >>> len(expectations)
        6
        >>> expectations[0].signal_type
        'submission_present'
    """
    return EXPECTED_SIGNALS_BY_DECISION_TYPE.get(
        decision_type.lower(),
        DEFAULT_SIGNALS
    )


def get_required_signals(decision_type: str) -> List[str]:
    """
    Get list of required signal types for a decision type.
    
    Args:
        decision_type: Decision type key
        
    Returns:
        List of required signal type names
        
    Example:
        >>> required = get_required_signals("csf")
        >>> "submission_present" in required
        True
        >>> "explainability_available" in required
        False
    """
    expectations = get_expected_signals(decision_type)
    return [exp.signal_type for exp in expectations if exp.required]


def get_signal_expectation(decision_type: str, signal_type: str) -> Optional[SignalExpectation]:
    """
    Get expectation for a specific signal type.
    
    Args:
        decision_type: Decision type key
        signal_type: Signal type to look up
        
    Returns:
        SignalExpectation if found, None otherwise
        
    Example:
        >>> exp = get_signal_expectation("csf", "submission_present")
        >>> exp.required
        True
        >>> exp.min_strength
        1.0
    """
    expectations = get_expected_signals(decision_type)
    for exp in expectations:
        if exp.signal_type == signal_type:
            return exp
    return None
