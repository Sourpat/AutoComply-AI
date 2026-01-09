"""
Migration: Add searchable_text column to cases table

Adds searchable_text column and index for improved search quality.
Backfills existing cases with normalized searchable text from:
- title
- summary
- decision_type
- assigned_to
- submission form_data (if linked)

Safe to run multiple times (idempotent).
"""

import sys
import os
import json
import re

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.core.db import execute_sql, execute_update


def normalize_search_text(text):
    """Normalize text for search (trim, lowercase, collapse whitespace)."""
    if not text:
        return ""
    normalized = text.strip().lower()
    normalized = re.sub(r'\s+', ' ', normalized)
    return normalized


def build_searchable_text(title, summary, decision_type, assigned_to, submission_fields=None):
    """Build normalized searchable text from case and submission fields."""
    parts = []
    
    # Core case fields
    parts.append(normalize_search_text(title))
    if summary:
        parts.append(normalize_search_text(summary))
    
    # Decision type (convert underscores to spaces)
    decision_type_readable = decision_type.replace('_', ' ')
    parts.append(normalize_search_text(decision_type_readable))
    
    if assigned_to:
        parts.append(normalize_search_text(assigned_to))
    
    # Optional submission fields
    if submission_fields:
        searchable_keys = [
            "practitionerName", "firstName", "lastName", "npi", "dea",
            "facilityName", "organizationName", "ein",
            "licenseNumber", "pharmacistName",
            "applicantName", "name", "email", "phone"
        ]
        
        for key in searchable_keys:
            value = submission_fields.get(key)
            if value:
                parts.append(normalize_search_text(str(value)))
    
    return ' '.join(filter(None, parts))


def main():
    print("=== Add searchable_text Column Migration ===\n")
    
    # Step 1: Add column (idempotent - won't fail if already exists)
    print("Step 1: Adding searchable_text column...")
    try:
        execute_sql("ALTER TABLE cases ADD COLUMN searchable_text TEXT", {})
        print("✓ Column added successfully")
    except Exception as e:
        if "duplicate column name" in str(e).lower():
            print("✓ Column already exists (skipping)")
        else:
            print(f"✗ Error adding column: {e}")
            return
    
    # Step 2: Create index (idempotent)
    print("\nStep 2: Creating index on searchable_text...")
    try:
        execute_sql("CREATE INDEX IF NOT EXISTS idx_cases_searchable_text ON cases(searchable_text)", {})
        print("✓ Index created successfully")
    except Exception as e:
        print(f"✗ Error creating index: {e}")
        return
    
    # Step 3: Backfill existing cases
    print("\nStep 3: Backfilling searchable_text for existing cases...")
    
    # Get all cases
    cases = execute_sql("SELECT id, title, summary, decision_type, assigned_to, submission_id FROM cases", {})
    print(f"Found {len(cases)} cases to process")
    
    updated_count = 0
    for case in cases:
        case_id = case["id"]
        title = case["title"] or ""
        summary = case["summary"]
        decision_type = case["decision_type"] or ""
        assigned_to = case["assigned_to"]
        submission_id = case["submission_id"]
        
        # Get submission fields if linked
        submission_fields = None
        if submission_id:
            try:
                submission_rows = execute_sql(
                    "SELECT form_data FROM submissions WHERE id = :submission_id",
                    {"submission_id": submission_id}
                )
                if submission_rows:
                    form_data_json = submission_rows[0].get("form_data", "{}")
                    submission_fields = json.loads(form_data_json) if form_data_json else None
            except Exception:
                pass
        
        # Build searchable text
        searchable_text = build_searchable_text(
            title=title,
            summary=summary,
            decision_type=decision_type,
            assigned_to=assigned_to,
            submission_fields=submission_fields
        )
        
        # Update case
        execute_update(
            "UPDATE cases SET searchable_text = :searchable_text WHERE id = :id",
            {"id": case_id, "searchable_text": searchable_text}
        )
        updated_count += 1
    
    print(f"✓ Updated {updated_count} cases with searchable_text")
    
    # Step 4: Verify
    print("\nStep 4: Verifying migration...")
    null_count = execute_sql("SELECT COUNT(*) as count FROM cases WHERE searchable_text IS NULL", {})
    if null_count and null_count[0]["count"] > 0:
        print(f"⚠ Warning: {null_count[0]['count']} cases still have NULL searchable_text")
    else:
        print("✓ All cases have searchable_text populated")
    
    print("\n=== Migration Complete ===\n")
    print("Search improvements:")
    print("  ✓ Normalized search (trim, lowercase, collapse whitespace)")
    print("  ✓ Search across title, summary, decision_type, assigned_to")
    print("  ✓ Includes submission fields (NPI, DEA, names, etc.)")
    print("  ✓ Indexed for performance")
    print("\nNew search capabilities:")
    print("  - Search by practitioner name from submission")
    print("  - Search by NPI, DEA, license numbers")
    print("  - Search by facility/organization names")
    print("  - Case-insensitive partial matching")


if __name__ == "__main__":
    main()
