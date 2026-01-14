# CSF Facility Field Aliases - Backward Compatibility

**Commit:** `a1da62a`

## Overview

Added backward-compatible field aliases to the Facility CSF endpoint to support legacy API payloads and old Swagger documentation examples without breaking existing integrations.

## Changes Made

### 1. FacilityControlledSubstance Model

**File:** [backend/src/autocomply/domain/csf_facility.py](backend/src/autocomply/domain/csf_facility.py)

**Added Fields:**
- `quantity: Optional[int]` with `validation_alias="qty"`
  - Accepts both `qty` and `quantity` in API requests
  - Maps to canonical `quantity` field

**OpenAPI Example:**
```json
{
  "id": "oxy-5mg",
  "name": "Oxycodone 5mg",
  "ndc": "00406-0512-01",
  "strength": "5mg",
  "dosage_form": "tablet",
  "dea_schedule": "II",
  "quantity": 100
}
```

### 2. FacilityCsfForm Model

**File:** [backend/src/autocomply/domain/csf_facility.py](backend/src/autocomply/domain/csf_facility.py)

**Added Fields:**
- `pharmacy_license_expiration: Optional[str]` with `validation_alias="licenseExpiration"`
  - Accepts `licenseExpiration` (camelCase), `license_expiration` (snake_case), or `pharmacy_license_expiration` (canonical)
  - Maps to canonical `pharmacy_license_expiration` field

**OpenAPI Example:**
```json
{
  "facility_name": "SummitCare Clinics – East Region",
  "facility_type": "facility",
  "account_number": "ACCT-445210",
  "pharmacy_license_number": "PHOH-76321",
  "pharmacy_license_expiration": "2025-12-31",
  "dea_number": "BS1234567",
  "pharmacist_in_charge_name": "Dr. Alexis Monroe",
  "pharmacist_contact_phone": "614-555-0198",
  "ship_to_state": "OH",
  "attestation_accepted": true,
  "controlled_substances": [...]
}
```

### 3. HospitalCsfForm Model

**File:** [backend/src/autocomply/domain/csf_hospital.py](backend/src/autocomply/domain/csf_hospital.py)

**Added Fields:**
- `pharmacy_license_expiration: Optional[str]` - Accepts pharmacy license expiration date

### 4. Backward Compatibility Tests

**File:** [backend/tests/test_csf_facility_field_aliases.py](backend/tests/test_csf_facility_field_aliases.py)

**Test Coverage:**
- ✅ `qty` alias works for controlled substance quantity
- ✅ `quantity` field works directly
- ✅ `licenseExpiration` (camelCase) works for pharmacy license expiration
- ✅ `license_expiration` (snake_case) works
- ✅ `pharmacy_license_expiration` (canonical) works
- ✅ Legacy Swagger payloads continue to work
- ✅ 422 errors only for truly missing required fields
- ✅ Optional fields don't cause 422 errors

## Supported Field Variations

### Controlled Substance Quantity
```json
// All these work:
{ "qty": 50 }
{ "quantity": 100 }
```

### Pharmacy License Expiration
```json
// All these work:
{ "licenseExpiration": "2025-12-31" }           // camelCase (legacy)
{ "license_expiration": "2025-12-31" }          // snake_case
{ "pharmacy_license_expiration": "2025-12-31" } // canonical
```

## Migration Path

### For Legacy Clients

No changes required! Old payloads continue to work:

```json
{
  "facility_name": "Legacy Hospital",
  "licenseExpiration": "2025-06-30",
  "controlled_substances": [
    {
      "id": "legacy-1",
      "name": "Morphine Sulfate",
      "qty": 200
    }
  ]
}
```

### For New Clients

Use canonical field names for clarity:

```json
{
  "facility_name": "Modern Facility",
  "pharmacy_license_expiration": "2025-06-30",
  "controlled_substances": [
    {
      "id": "modern-1",
      "name": "Morphine Sulfate",
      "quantity": 200
    }
  ]
}
```

## Error Handling

### 422 Validation Errors

Only returned when **truly required** fields are missing:

**Required Fields:**
- `facility_name`
- `facility_type`
- `pharmacy_license_number`
- `dea_number`
- `pharmacist_in_charge_name`
- `ship_to_state`
- `attestation_accepted` (defaults to `false`)

**Optional Fields:**
- `pharmacy_license_expiration` (new!)
- `quantity` in controlled substances (new!)
- `account_number`
- `pharmacist_contact_phone`
- `internal_notes`
- All other controlled substance fields

### Clear Error Messages

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "facility_name"],
      "msg": "Field required",
      "input": {...}
    }
  ]
}
```

## API Documentation

### Swagger/OpenAPI

The updated models include comprehensive `json_schema_extra` examples that:
- Show canonical field names
- Include realistic sample data
- Match actual validation requirements
- Display in Swagger UI automatically

### Endpoint

**POST** `/csf/facility/evaluate`

**Request Body:** `FacilityCsfForm`

**Response:** `FacilityCsfEvaluateResponse`

```json
{
  "decision": {
    "status": "ok_to_ship",
    "reason": "All requirements met",
    "regulatory_references": [...]
  },
  "status": "ok_to_ship",
  "reason": "All requirements met",
  "missing_fields": [],
  "regulatory_references": ["csf_facility_form"],
  "trace_id": "uuid-here"
}
```

## Testing

Run backward compatibility tests:

```bash
cd backend
.venv/Scripts/python -m pytest tests/test_csf_facility_field_aliases.py -v
```

Run all CSF Facility tests:

```bash
.venv/Scripts/python -m pytest tests/test_csf_facility_api.py -v
```

## Benefits

1. **Zero Breaking Changes** - Old API clients continue to work
2. **Clear Migration Path** - New clients can use canonical names
3. **Better Documentation** - OpenAPI examples match actual usage
4. **Type Safety** - Pydantic validation ensures data integrity
5. **Flexible Integration** - Supports multiple naming conventions

## Related Documentation

- [Facility CSF Vertical](backend/docs/verticals/facility_csf_vertical.md)
- [API Reference](docs/api_reference.md)
- [CSF Testing Guide](backend/tests/test_csf_facility_api.py)

## Future Enhancements

Potential additions if needed:
- `expires_on` alias for license expiration (currently only `licenseExpiration` and `license_expiration`)
- `amount` alias for quantity
- Date validation for expiration fields
- Expiration date logic in decision engine
