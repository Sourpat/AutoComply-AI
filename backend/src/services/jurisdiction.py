# backend/src/services/jurisdiction.py
"""
Jurisdiction detection utilities for state-based content filtering.

Recognizes all 50 US states, DC, and common territories with abbreviations.
"""

from typing import Set, Optional
import re

# Comprehensive mapping of state names to their abbreviations
STATE_MAPPINGS = {
    "alabama": "AL",
    "alaska": "AK",
    "arizona": "AZ",
    "arkansas": "AR",
    "california": "CA",
    "colorado": "CO",
    "connecticut": "CT",
    "delaware": "DE",
    "florida": "FL",
    "georgia": "GA",
    "hawaii": "HI",
    "idaho": "ID",
    "illinois": "IL",
    "indiana": "IN",
    "iowa": "IA",
    "kansas": "KS",
    "kentucky": "KY",
    "louisiana": "LA",
    "maine": "ME",
    "maryland": "MD",
    "massachusetts": "MA",
    "michigan": "MI",
    "minnesota": "MN",
    "mississippi": "MS",
    "missouri": "MO",
    "montana": "MT",
    "nebraska": "NE",
    "nevada": "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    "ohio": "OH",
    "oklahoma": "OK",
    "oregon": "OR",
    "pennsylvania": "PA",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    "tennessee": "TN",
    "texas": "TX",
    "utah": "UT",
    "vermont": "VT",
    "virginia": "VA",
    "washington": "WA",
    "west virginia": "WV",
    "wisconsin": "WI",
    "wyoming": "WY",
    "district of columbia": "DC",
    "washington dc": "DC",
    "puerto rico": "PR",
    "guam": "GU",
    "us virgin islands": "VI",
}

# Reverse mapping for quick lookup
ABBREV_TO_NAME = {v: k for k, v in STATE_MAPPINGS.items()}


def extract_states(text: str) -> Set[str]:
    """
    Extract US state abbreviations from text.
    
    Returns a set of 2-letter state codes (e.g., {"NJ", "NY"}).
    Returns empty set if no states detected.
    
    Args:
        text: Text to search for state references
        
    Returns:
        Set of state abbreviations (2-letter codes)
    """
    if not text:
        return set()
    
    text_lower = text.lower()
    detected_states = set()
    
    # Check for full state names
    for state_name, abbrev in STATE_MAPPINGS.items():
        # Use word boundaries to avoid partial matches
        pattern = r'\b' + re.escape(state_name) + r'\b'
        if re.search(pattern, text_lower):
            detected_states.add(abbrev)
    
    # Check for abbreviations (2 capital letters)
    # Look for patterns like "NJ" or "N.J."
    abbrev_pattern = r'\b([A-Z]{2})\b'
    for match in re.finditer(abbrev_pattern, text):
        abbrev = match.group(1)
        if abbrev in ABBREV_TO_NAME:
            detected_states.add(abbrev)
    
    # Also check for dotted abbreviations like "N.J."
    dotted_pattern = r'\b([A-Z])\.([A-Z])\.'
    for match in re.finditer(dotted_pattern, text):
        abbrev = match.group(1) + match.group(2)
        if abbrev in ABBREV_TO_NAME:
            detected_states.add(abbrev)
    
    return detected_states


def has_jurisdiction_mismatch(
    requested_states: Set[str],
    entry_states: Set[str]
) -> bool:
    """
    Check if there's a jurisdiction mismatch.
    
    Mismatch occurs when:
    - User requested specific states (requested_states is not empty)
    - KB entry has specific states (entry_states is not empty)
    - The two sets don't overlap
    
    Args:
        requested_states: States mentioned in user question
        entry_states: States mentioned in KB entry
        
    Returns:
        True if there's a mismatch (should reject), False otherwise
    """
    # If user didn't specify states, any entry is OK
    if not requested_states:
        return False
    
    # If entry has no states, it's generic (can match any request)
    if not entry_states:
        return False
    
    # Both have states - check for overlap
    return len(requested_states.intersection(entry_states)) == 0


def format_states(states: Set[str]) -> str:
    """Format state set for display."""
    if not states:
        return "none"
    return ", ".join(sorted(states))


def detect_requested_state(question: str) -> Optional[dict]:
    """
    Detect the first requested US state in a question.
    
    Returns:
        {"code": "RI", "name": "rhode island"} if state found
        None if no state detected
    """
    states = extract_states(question)
    if not states:
        return None
    
    # Return the first state found with its full name
    state_code = sorted(states)[0]  # Consistent ordering
    state_name = ABBREV_TO_NAME.get(state_code)
    
    if state_name:
        return {
            "code": state_code,
            "name": state_name
        }
    
    return None
