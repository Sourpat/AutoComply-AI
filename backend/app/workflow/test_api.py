"""
Workflow Router - API Test Script

Step 2.10: API Endpoints Testing

Tests all workflow API endpoints using requests.
Run with: python backend/app/workflow/test_api.py

Prerequisites:
- Backend server running on http://localhost:8001
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8001"


def print_section(title):
    """Print a section header."""
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print('=' * 60)


def test_health():
    """Test health check endpoint."""
    print_section("Health Check")
    
    response = requests.get(f"{BASE_URL}/workflow/health")
    print(f"GET /workflow/health")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    assert response.status_code == 200
    assert response.json()["ok"] is True
    print("✅ Health check passed")
    return True


def test_create_case():
    """Test creating a case."""
    print_section("Create Case")
    
    payload = {
        "decisionType": "csf_practitioner",
        "title": "Dr. Sarah Smith - CSF Application",
        "summary": "Application for controlled substance facilitation",
        "submissionId": "sub-test-12345",
        "dueAt": (datetime.utcnow() + timedelta(hours=24)).isoformat()
    }
    
    response = requests.post(
        f"{BASE_URL}/workflow/cases",
        json=payload
    )
    
    print(f"POST /workflow/cases")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Created case ID: {data['id']}")
    print(f"Title: {data['title']}")
    print(f"Status: {data['status']}")
    
    assert response.status_code == 201
    assert data["decisionType"] == "csf_practitioner"
    assert data["status"] == "new"
    print("✅ Case created successfully")
    
    return data["id"]


def test_get_case(case_id):
    """Test getting a case by ID."""
    print_section("Get Case by ID")
    
    response = requests.get(f"{BASE_URL}/workflow/cases/{case_id}")
    
    print(f"GET /workflow/cases/{case_id}")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Title: {data['title']}")
    print(f"Status: {data['status']}")
    print(f"Created: {data['createdAt']}")
    
    assert response.status_code == 200
    assert data["id"] == case_id
    print("✅ Case retrieved successfully")


def test_list_cases():
    """Test listing cases."""
    print_section("List Cases")
    
    # List all cases
    response = requests.get(f"{BASE_URL}/workflow/cases")
    print(f"GET /workflow/cases (all)")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Total cases: {len(data)}")
    
    assert response.status_code == 200
    assert len(data) > 0
    
    # Filter by status
    response = requests.get(f"{BASE_URL}/workflow/cases?status=new")
    print(f"\nGET /workflow/cases?status=new")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"New cases: {len(data)}")
    
    assert response.status_code == 200
    
    # Search
    response = requests.get(f"{BASE_URL}/workflow/cases?q=Sarah")
    print(f"\nGET /workflow/cases?q=Sarah")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Search results: {len(data)}")
    
    assert response.status_code == 200
    print("✅ Case listing works")


def test_update_case(case_id):
    """Test updating a case."""
    print_section("Update Case")
    
    payload = {
        "status": "in_review",
        "assignedTo": "verifier@example.com"
    }
    
    response = requests.patch(
        f"{BASE_URL}/workflow/cases/{case_id}",
        json=payload
    )
    
    print(f"PATCH /workflow/cases/{case_id}")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"New status: {data['status']}")
    print(f"Assigned to: {data['assignedTo']}")
    
    assert response.status_code == 200
    assert data["status"] == "in_review"
    assert data["assignedTo"] == "verifier@example.com"
    print("✅ Case updated successfully")


def test_get_audit_events(case_id):
    """Test getting audit timeline."""
    print_section("Get Audit Timeline")
    
    response = requests.get(f"{BASE_URL}/workflow/cases/{case_id}/audit")
    
    print(f"GET /workflow/cases/{case_id}/audit")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Total events: {len(data)}")
    
    print("\nTimeline:")
    for event in reversed(data):  # Show oldest first
        print(f"  • {event['eventType']}: {event['message']}")
    
    assert response.status_code == 200
    assert len(data) >= 2  # Should have at least case_created and status_changed
    print("✅ Audit timeline retrieved")


def test_add_audit_event(case_id):
    """Test adding a custom audit event."""
    print_section("Add Custom Audit Event")
    
    payload = {
        "caseId": case_id,
        "eventType": "note_added",
        "actor": "reviewer@example.com",
        "message": "Reviewed documents - looks good",
        "meta": {
            "noteType": "internal",
            "rating": 5
        }
    }
    
    response = requests.post(
        f"{BASE_URL}/workflow/cases/{case_id}/audit",
        json=payload
    )
    
    print(f"POST /workflow/cases/{case_id}/audit")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Event type: {data['eventType']}")
    print(f"Message: {data['message']}")
    
    assert response.status_code == 201
    assert data["eventType"] == "note_added"
    print("✅ Audit event added")


def test_attach_evidence(case_id):
    """Test attaching evidence."""
    print_section("Attach Evidence")
    
    payload = {
        "evidence": [
            {
                "id": "ev-test-1",
                "title": "OAC 4723-9-10 - CSF Practitioner Requirements",
                "snippet": "All practitioners must complete required training...",
                "citation": "OAC 4723-9-10",
                "sourceId": "doc-ohio-csf-001",
                "tags": ["Ohio", "CSF", "Training"],
                "metadata": {"confidence": 0.95},
                "includedInPacket": True
            },
            {
                "id": "ev-test-2",
                "title": "Federal DEA Requirements",
                "snippet": "Federal DEA registration required...",
                "citation": "21 CFR 1301",
                "sourceId": "doc-federal-dea-001",
                "tags": ["Federal", "DEA"],
                "metadata": {"confidence": 0.88},
                "includedInPacket": True
            }
        ],
        "source": "rag_api",
        "sourceMeta": {
            "query": "CSF practitioner requirements",
            "searchType": "regulatory"
        }
    }
    
    response = requests.post(
        f"{BASE_URL}/workflow/cases/{case_id}/evidence/attach",
        json=payload
    )
    
    print(f"POST /workflow/cases/{case_id}/evidence/attach")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Evidence attached: {len(data['evidence'])}")
    print(f"Packet includes: {len(data['packetEvidenceIds'])}")
    
    assert response.status_code == 200
    assert len(data["evidence"]) == 2
    assert len(data["packetEvidenceIds"]) == 2
    print("✅ Evidence attached successfully")


def test_update_packet(case_id):
    """Test updating packet evidence selection."""
    print_section("Update Evidence Packet")
    
    # Update to only include first evidence item
    payload = ["ev-test-1"]
    
    response = requests.patch(
        f"{BASE_URL}/workflow/cases/{case_id}/evidence/packet",
        json=payload
    )
    
    print(f"PATCH /workflow/cases/{case_id}/evidence/packet")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Evidence total: {len(data['evidence'])}")
    print(f"Packet includes: {len(data['packetEvidenceIds'])}")
    print(f"Packet IDs: {data['packetEvidenceIds']}")
    
    assert response.status_code == 200
    assert len(data["evidence"]) == 2  # Evidence unchanged
    assert len(data["packetEvidenceIds"]) == 1  # Only 1 in packet
    assert "ev-test-1" in data["packetEvidenceIds"]
    print("✅ Packet updated successfully")


def test_case_not_found():
    """Test 404 handling."""
    print_section("Error Handling - 404")
    
    response = requests.get(f"{BASE_URL}/workflow/cases/nonexistent-id")
    
    print(f"GET /workflow/cases/nonexistent-id")
    print(f"Status: {response.status_code}")
    print(f"Error: {response.json()['detail']}")
    
    assert response.status_code == 404
    print("✅ 404 handling works")


def test_invalid_status():
    """Test 400 handling for invalid status."""
    print_section("Error Handling - 400")
    
    response = requests.get(f"{BASE_URL}/workflow/cases?status=invalid_status")
    
    print(f"GET /workflow/cases?status=invalid_status")
    print(f"Status: {response.status_code}")
    print(f"Error: {response.json()['detail']}")
    
    assert response.status_code == 400
    print("✅ 400 validation works")


def run_all_tests():
    """Run all API tests."""
    print("=" * 60)
    print("WORKFLOW API TESTS")
    print("=" * 60)
    print(f"\nBase URL: {BASE_URL}")
    print(f"Timestamp: {datetime.utcnow().isoformat()}")
    
    try:
        # Test endpoints
        test_health()
        case_id = test_create_case()
        test_get_case(case_id)
        test_list_cases()
        test_update_case(case_id)
        test_get_audit_events(case_id)
        test_add_audit_event(case_id)
        test_attach_evidence(case_id)
        test_update_packet(case_id)
        test_case_not_found()
        test_invalid_status()
        
        # Final audit check
        print_section("Final Audit Timeline")
        response = requests.get(f"{BASE_URL}/workflow/cases/{case_id}/audit")
        events = response.json()
        print(f"Total events: {len(events)}\n")
        print("Complete timeline:")
        for event in reversed(events):
            print(f"  {event['createdAt'][:19]} | {event['eventType']:20} | {event['message']}")
        
        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED!")
        print("=" * 60)
        print("\nStep 2.10: API Endpoints ✓ COMPLETE")
        print("\nReady for:")
        print("- Frontend integration")
        print("- End-to-end workflow testing")
        print("- Production deployment")
        
        return 0
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    except requests.exceptions.ConnectionError:
        print(f"\n❌ ERROR: Cannot connect to {BASE_URL}")
        print("Make sure the backend server is running:")
        print("  cd backend")
        print("  .\.venv\Scripts\python.exe -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001")
        return 1
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    import sys
    sys.exit(run_all_tests())
