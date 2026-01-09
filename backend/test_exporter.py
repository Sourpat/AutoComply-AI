"""
Test Case Export Functionality

Tests the exporter module:
1. build_case_bundle() - Bundle creation
2. generate_pdf() - PDF generation
3. Export endpoints - JSON and PDF exports
"""

import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.workflow.exporter import build_case_bundle, generate_pdf
from app.workflow.repo import create_case, reset_store
from app.workflow.models import CaseCreateInput, EvidenceItem
from app.submissions.repo import create_submission
from app.submissions.models import SubmissionCreateInput
from src.core.db import init_db


def test_build_case_bundle():
    """Test case bundle creation."""
    print("\n=== Testing build_case_bundle() ===")
    
    # Create a test case with evidence
    case_input = CaseCreateInput(
        decisionType="csf",
        title="Test Case - Export Demo",
        summary="Testing export functionality",
        evidence=[
            EvidenceItem(
                id="ev-1",
                title="OAC 4723-9-10",
                snippet="Prescriptive authority for CNPs...",
                citation="OAC 4723-9-10",
                sourceId="doc-123",
                tags=["prescribing", "cnp"],
                metadata={"source": "ohio_law"},
                includedInPacket=True,
            ),
            EvidenceItem(
                id="ev-2",
                title="ORC 4723.48",
                snippet="Advanced practice nursing...",
                citation="ORC 4723.48",
                sourceId="doc-124",
                tags=["advanced_practice"],
                metadata={"source": "ohio_law"},
                includedInPacket=False,
            ),
        ]
    )
    
    case = create_case(case_input)
    print(f"✓ Created test case: {case.id}")
    
    # Build bundle
    bundle = build_case_bundle(case.id)
    assert bundle is not None, "Bundle should not be None"
    print(f"✓ Built case bundle")
    
    # Verify bundle structure
    assert "case" in bundle
    assert "submission" in bundle
    assert "auditTimeline" in bundle
    assert "evidence" in bundle
    assert "packetEvidence" in bundle
    assert "metadata" in bundle
    print(f"✓ Bundle has all required keys")
    
    # Verify case data
    assert bundle["case"]["id"] == case.id
    assert bundle["case"]["title"] == "Test Case - Export Demo"
    print(f"✓ Case data correct")
    
    # Verify evidence
    assert len(bundle["evidence"]) == 2
    assert len(bundle["packetEvidence"]) == 1  # Only ev-1 included
    print(f"✓ Evidence filtering correct (1 of 2 in packet)")
    
    # Verify audit timeline (should have CASE_CREATED event)
    audit_count = len(bundle["auditTimeline"])
    print(f"✓ Audit timeline has {audit_count} event(s)")
    
    return case.id


def test_build_bundle_with_submission():
    """Test bundle creation with linked submission."""
    print("\n=== Testing Bundle with Submission ===")
    
    # Create submission
    submission_input = SubmissionCreateInput(
        decisionType="csf",
        submittedBy="user@example.com",
        formData={
            "practitionerName": "Dr. Jane Smith",
            "licenseNumber": "NP.12345",
            "question": "Can I prescribe controlled substances?"
        },
        evaluatorOutput={
            "decision": "approved",
            "confidence": 0.95,
            "reasoning": "Valid CNP license with prescriptive authority"
        }
    )
    
    submission = create_submission(submission_input)
    print(f"✓ Created submission: {submission.id}")
    
    # Create case linked to submission
    case_input = CaseCreateInput(
        decisionType="csf",
        title="Case with Submission",
        summary="Testing submission linkage",
        submissionId=submission.id,
        evidence=[
            EvidenceItem(
                id="ev-sub-1",
                title="Test Evidence",
                snippet="Evidence content...",
                citation="Test Citation",
                sourceId="doc-999",
                tags=["test"],
                metadata={},
                includedInPacket=True,
            )
        ]
    )
    
    case = create_case(case_input)
    print(f"✓ Created case linked to submission")
    
    # Build bundle
    bundle = build_case_bundle(case.id)
    assert bundle["submission"] is not None
    print(f"✓ Bundle includes submission data")
    
    # Verify submission data
    assert bundle["submission"]["id"] == submission.id
    assert bundle["submission"]["formData"]["practitionerName"] == "Dr. Jane Smith"
    assert bundle["submission"]["evaluatorOutput"]["decision"] == "approved"
    print(f"✓ Submission data complete")
    
    return case.id


def test_generate_pdf(case_id: str):
    """Test PDF generation."""
    print("\n=== Testing PDF Generation ===")
    
    # Build bundle
    bundle = build_case_bundle(case_id)
    assert bundle is not None
    
    # Generate PDF
    pdf_bytes = generate_pdf(bundle)
    assert pdf_bytes is not None
    assert len(pdf_bytes) > 0
    print(f"✓ Generated PDF: {len(pdf_bytes):,} bytes")
    
    # Verify it's a PDF (starts with %PDF-)
    assert pdf_bytes[:5] == b'%PDF-'
    print(f"✓ Valid PDF format")
    
    # Save for manual inspection
    output_path = backend_dir / "test_case_packet.pdf"
    with open(output_path, "wb") as f:
        f.write(pdf_bytes)
    print(f"✓ Saved PDF to: {output_path}")
    
    return pdf_bytes


def test_pdf_with_submission(case_id: str):
    """Test PDF generation with submission data."""
    print("\n=== Testing PDF with Submission ===")
    
    # Build bundle
    bundle = build_case_bundle(case_id)
    assert bundle["submission"] is not None
    
    # Generate PDF
    pdf_bytes = generate_pdf(bundle)
    assert len(pdf_bytes) > 0
    print(f"✓ Generated PDF with submission: {len(pdf_bytes):,} bytes")
    
    # Save for manual inspection
    output_path = backend_dir / "test_case_packet_with_submission.pdf"
    with open(output_path, "wb") as f:
        f.write(pdf_bytes)
    print(f"✓ Saved PDF with submission to: {output_path}")


def test_bundle_not_found():
    """Test bundle creation for non-existent case."""
    print("\n=== Testing Bundle Not Found ===")
    
    bundle = build_case_bundle("non-existent-case-id")
    assert bundle is None
    print(f"✓ Returns None for non-existent case")


def main():
    """Run all export tests."""
    print("=" * 70)
    print("Case Export Test Suite")
    print("=" * 70)
    
    # Initialize database
    print("\n=== Initializing Database ===")
    init_db()
    print("✓ Database initialized")
    
    # Clean slate
    print("\n=== Resetting Store ===")
    reset_store()
    print("✓ Store reset")
    
    try:
        # Run tests
        case_id = test_build_case_bundle()
        test_generate_pdf(case_id)
        
        case_with_sub_id = test_build_bundle_with_submission()
        test_pdf_with_submission(case_with_sub_id)
        
        test_bundle_not_found()
        
        print("\n" + "=" * 70)
        print("✅ ALL EXPORT TESTS PASSED!")
        print("=" * 70)
        print("\nGenerated Files:")
        print("  • test_case_packet.pdf - Basic case packet")
        print("  • test_case_packet_with_submission.pdf - Packet with submission")
        print("\nPDF Sections:")
        print("  1. Cover Page - Case metadata")
        print("  2. Submission Summary - Form data (if linked)")
        print("  3. Decision Summary - Evaluator output (if available)")
        print("  4. Evidence Packet - Included evidence with citations")
        print("  5. Audit Timeline - Chronological events")
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
