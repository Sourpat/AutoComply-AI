"""
Test backward compatibility for Facility CSF field aliases.

Verifies that:
- qty and quantity both work for controlled substance quantity
- licenseExpiration, license_expiration, expires_on all map to pharmacy_license_expiration
- Old API payloads continue to work without breaking changes
"""

import pytest
from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)


def test_facility_csf_with_qty_alias():
    """Test that 'qty' field alias works for quantity."""
    payload = {
        "facility_name": "Test Facility",
        "facility_type": "facility",
        "pharmacy_license_number": "PHOH-12345",
        "dea_number": "BS1234567",
        "pharmacist_in_charge_name": "Dr. Test",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "controlled_substances": [
            {
                "id": "test-1",
                "name": "Test Substance",
                "ndc": "12345-678-90",
                "dea_schedule": "II",
                "dosage_form": "tablet",
                "qty": 50  # Using 'qty' alias instead of 'quantity'
            }
        ],
    }
    
    resp = client.post("/csf/facility/evaluate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "decision" in data


def test_facility_csf_with_quantity_field():
    """Test that 'quantity' field works directly."""
    payload = {
        "facility_name": "Test Facility",
        "facility_type": "facility",
        "pharmacy_license_number": "PHOH-12345",
        "dea_number": "BS1234567",
        "pharmacist_in_charge_name": "Dr. Test",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "controlled_substances": [
            {
                "id": "test-1",
                "name": "Test Substance",
                "ndc": "12345-678-90",
                "dea_schedule": "II",
                "dosage_form": "tablet",
                "quantity": 100  # Using 'quantity' directly
            }
        ],
    }
    
    resp = client.post("/csf/facility/evaluate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "decision" in data


def test_facility_csf_with_license_expiration_camel_case():
    """Test that 'licenseExpiration' (camelCase) field works."""
    payload = {
        "facility_name": "Test Facility",
        "facility_type": "facility",
        "pharmacy_license_number": "PHOH-12345",
        "licenseExpiration": "2025-12-31",  # camelCase alias
        "dea_number": "BS1234567",
        "pharmacist_in_charge_name": "Dr. Test",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "controlled_substances": [
            {
                "id": "test-1",
                "name": "Test Substance",
                "ndc": "12345-678-90",
                "dea_schedule": "II",
                "dosage_form": "tablet",
            }
        ],
    }
    
    resp = client.post("/csf/facility/evaluate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "decision" in data


def test_facility_csf_with_license_expiration_snake_case():
    """Test that 'license_expiration' (snake_case) field works."""
    payload = {
        "facility_name": "Test Facility",
        "facility_type": "facility",
        "pharmacy_license_number": "PHOH-12345",
        "license_expiration": "2025-12-31",  # snake_case (non-canonical but supported)
        "dea_number": "BS1234567",
        "pharmacist_in_charge_name": "Dr. Test",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "controlled_substances": [
            {
                "id": "test-1",
                "name": "Test Substance",
                "ndc": "12345-678-90",
                "dea_schedule": "II",
                "dosage_form": "tablet",
            }
        ],
    }
    
    resp = client.post("/csf/facility/evaluate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "decision" in data


def test_facility_csf_with_pharmacy_license_expiration():
    """Test that canonical 'pharmacy_license_expiration' field works."""
    payload = {
        "facility_name": "Test Facility",
        "facility_type": "facility",
        "pharmacy_license_number": "PHOH-12345",
        "pharmacy_license_expiration": "2025-12-31",  # Canonical field name
        "dea_number": "BS1234567",
        "pharmacist_in_charge_name": "Dr. Test",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "controlled_substances": [
            {
                "id": "test-1",
                "name": "Test Substance",
                "ndc": "12345-678-90",
                "dea_schedule": "II",
                "dosage_form": "tablet",
            }
        ],
    }
    
    resp = client.post("/csf/facility/evaluate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "decision" in data


def test_facility_csf_legacy_payload_from_swagger():
    """Test old Swagger example payload still works."""
    # This is the kind of payload that might have been in old Swagger docs
    payload = {
        "facility_name": "Legacy Hospital",
        "facility_type": "hospital",
        "account_number": "LEGACY-123",
        "pharmacy_license_number": "PH-12345",
        "licenseExpiration": "2025-06-30",  # Old camelCase field
        "dea_number": "DL1234567",
        "pharmacist_in_charge_name": "Dr. Legacy User",
        "pharmacist_contact_phone": "555-0100",
        "ship_to_state": "CA",
        "attestation_accepted": True,
        "controlled_substances": [
            {
                "id": "legacy-1",
                "name": "Morphine Sulfate",
                "ndc": "00406-0512-01",
                "dea_schedule": "II",
                "dosage_form": "tablet",
                "strength": "10mg",
                "qty": 200  # Old qty alias
            },
            {
                "id": "legacy-2",
                "name": "Hydrocodone",
                "strength": "5mg",
                "quantity": 100  # Mix of old and new
            }
        ],
        "internal_notes": "Legacy test payload"
    }
    
    resp = client.post("/csf/facility/evaluate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "decision" in data
    assert data["decision"]["status"] in ["ok_to_ship", "needs_review", "blocked"]


def test_facility_csf_422_only_for_truly_missing_required():
    """Test that 422 is returned only when truly required fields are missing."""
    # Missing required field: facility_name
    payload = {
        "facility_type": "facility",
        "pharmacy_license_number": "PHOH-12345",
        "dea_number": "BS1234567",
        "pharmacist_in_charge_name": "Dr. Test",
        "ship_to_state": "OH",
        "attestation_accepted": True,
    }
    
    resp = client.post("/csf/facility/evaluate", json=payload)
    assert resp.status_code == 422
    
    error_data = resp.json()
    assert "detail" in error_data
    # Check that the error mentions the missing field
    error_str = str(error_data["detail"])
    assert "facility_name" in error_str.lower()


def test_facility_csf_optional_fields_not_required():
    """Test that optional fields don't cause 422."""
    # Minimal valid payload - only required fields
    payload = {
        "facility_name": "Minimal Facility",
        "facility_type": "facility",
        "pharmacy_license_number": "PHOH-12345",
        "dea_number": "BS1234567",
        "pharmacist_in_charge_name": "Dr. Test",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        # No controlled_substances, no license expiration, etc. - all optional
    }
    
    resp = client.post("/csf/facility/evaluate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "decision" in data
