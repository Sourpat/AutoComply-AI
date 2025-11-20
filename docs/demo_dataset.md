# Demo Dataset & Live Story

## Purpose  
Demonstrate the full end-to-end compliance engine for controlled substances.  
Includes a set of 5 synthetic practitioner licenses + state permits + checkout scenarios.

## Sample Records  
| ID | Practitioner | Practice Type | DEA # | DEA Expiry | State | Permit # | State Expiry | Purchase Intent | Quantity | Expected Outcome |
|----|--------------|--------------|-------|------------|--------|----------|--------------|----------------|----------|------------------|
| 1  | Dr John Smith | Standard     | AB1234567 | 2027-06-30 | CA     | C987654   | 2028-08-15  | GeneralMedicalUse | 100      | Cleared          |
| 2  | Dr Jane Doe   | Standard     | AB0000000 | Expired     | NV     | N123456   | 2025-01-01  | Testosterone      | 12       | Blocked → Addendum |
| 3  | Hospital Pharm | HospitalPharmacy | —    | —          | FL     | F654321   | 2026-12-01  | WeightLoss         | 3500     | Addendum required |
| 4  | Researcher A   | Researcher   | CD7654321 | 2029-11-01 | TX     | T112233   | 2030-07-20  | Research           | 1         | Cleared          |
| 5  | EMS Corp       | EMS          | EF9999999 | 2028-03-15 | AZ     | A445566   | 2027-09-30  | Testosterone      | 8         | Blocked → Under threshold |

## Live Story  
1. User uploads Dr John Smith’s PDF → Extract => compliance card shows “CLEARED for Checkout”.  
2. User switches to Manual Entry, enters Dr Jane Doe’s record, triggers attestation modal because Testosterone + quantity ≥10, user confirms → card shows “Addendum required: Testosterone Addendum”.  
3. Checkout button is disabled unless addendum is uploaded (future step).  
4. In Hospital scenario, state is FL, practice type HospitalPharmacy, weight-loss tweak triggers alert.  
5. Researcher scenario passes with minimal fields.  
6. EMS scenario fails quantity threshold.  

## Next Steps  
- Create JSON export of the dataset in `docs/demo_records.json` to import into tests.  
- Create GitHub Actions workflow to run UI snapshot and API contract tests.  
- Record a 30-second GIF via “Screenshot” of workflow and attach to README.  
