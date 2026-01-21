"""
Test script for Submissions API

Tests all 3 endpoints:
- POST /submissions (create)
- GET /submissions (list)
- GET /submissions/{id} (get by ID)
"""

import requests
from datetime import datetime, timezone

BASE_URL = "http://localhost:8001"


def print_section(title: str):
    """Print a section header."""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def test_create_submission():
    """Test creating a submission."""
    print_section("Create Submission")
    
    payload = {
        "decisionType": "csf",
        "submittedBy": "user@example.com",
        "accountId": "account-123",
        "locationId": "location-456",
        "formData": {
            "name": "Dr. Sarah Smith",
            "licenseNumber": "MD-12345",
            "specialty": "Anesthesiology",
            "yearsOfExperience": 10
        },
        "evaluatorOutput": {
            "decision": "approved",
            "confidence": 0.95
        }
    }
    
    response = requests.post(
        f"{BASE_URL}/submissions",
        json=payload
    )
    
    print(f"POST /submissions")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Created submission ID: {data['id']}")
    print(f"Decision type: {data['decisionType']}")
    print(f"Submitted by: {data['submittedBy']}")
    print(f"Form data keys: {list(data['formData'].keys())}")
    
    assert response.status_code == 201
    assert data["decisionType"] == "csf"
    assert data["submittedBy"] == "user@example.com"
    print("✅ Submission created successfully")
    
    return data["id"]


def test_get_submission(submission_id: str):
    """Test retrieving a submission by ID."""
    print_section("Get Submission by ID")
    
    response = requests.get(f"{BASE_URL}/submissions/{submission_id}")
    
    print(f"GET /submissions/{submission_id}")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Decision type: {data['decisionType']}")
    print(f"Form data: {data['formData']['name']}")
    print(f"Evaluator decision: {data['evaluatorOutput']['decision']}")
    
    assert response.status_code == 200
    assert data["id"] == submission_id
    print("✅ Submission retrieved successfully")


def test_list_submissions():
    """Test listing submissions."""
    print_section("List Submissions")
    
    # Create a few more submissions
    for i in range(2):
        payload = {
            "decisionType": "csa" if i == 0 else "csf",
            "submittedBy": f"user{i}@example.com",
            "formData": {
                "testCase": i,
                "name": f"Test User {i}"
            }
        }
        requests.post(f"{BASE_URL}/submissions", json=payload)
    
    # List all submissions
    response = requests.get(f"{BASE_URL}/submissions")
    
    print(f"\nGET /submissions (all)")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Total submissions: {len(data)}")
    
    assert response.status_code == 200
    assert len(data) >= 3
    
    # Filter by decision type
    response = requests.get(f"{BASE_URL}/submissions?decisionType=csf")
    print(f"\nGET /submissions?decisionType=csf")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"CSF submissions: {len(data)}")
    
    assert response.status_code == 200
    assert all(s["decisionType"] == "csf" for s in data)
    
    # Filter by submitter
    response = requests.get(f"{BASE_URL}/submissions?submittedBy=user@example.com")
    print(f"\nGET /submissions?submittedBy=user@example.com")
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Submissions by user@example.com: {len(data)}")
    
    assert response.status_code == 200
    print("✅ Submission listing works")


def test_error_handling():
    """Test error handling."""
    print_section("Error Handling")
    
    # Try to get non-existent submission
    response = requests.get(f"{BASE_URL}/submissions/nonexistent-id")
    
    print(f"GET /submissions/nonexistent-id")
    print(f"Status: {response.status_code}")
    print(f"Error: {response.json()['detail']}")
    
    assert response.status_code == 404
    print("✅ 404 handling works")


def run_all_tests():
    """Run all test scenarios."""
    try:
        print("="*60)
        print("SUBMISSIONS API TESTS")
        print("="*60)
        print(f"\nBase URL: {BASE_URL}")
        print(f"Timestamp: {datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')}")
        
        # Run tests
        submission_id = test_create_submission()
        test_get_submission(submission_id)
        test_list_submissions()
        test_error_handling()
        
        print_section("✅ ALL TESTS PASSED!")
        print("\nSubmissions API is ready for integration!")
        
        return 0
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    except requests.exceptions.ConnectionError:
        print(f"\n❌ ERROR: Cannot connect to {BASE_URL}")
        print("Make sure the backend server is running:")
        print("  cd backend")
        print("  .venv/Scripts/python.exe -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001")
        return 1
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    import sys
    sys.exit(run_all_tests())
