# Phase 5 Plan — Submitter → Verifier Queue

## Phase 5.1 (Minimal Slice)

**Goal**: Submitter submissions flow into the Verifier Console queue deterministically and idempotently.

### Scope
- Submitter submission endpoint creates a linked verifier case.
- Verifier list/detail include submission linkage and summary.
- Submission detail endpoint for verifier context.
- Dev-only submitter trigger in UI.
- Ops smoke check for submitter → verifier flow.
- Tests + CI gate updated.

### Acceptance
- POST /api/submitter/submissions creates submission + linked verifier case.
- Idempotency by `submission_id` or `client_token`.
- /api/verifier/cases list + detail include submission summary.
- /api/verifier/cases/{case_id}/submission returns submission payload.

### Verification
- `C:/Python314/python.exe -m pytest -q tests/test_submitter_to_verifier_flow.py`
- `npm run build`

### Notes
- In-memory submission store is sufficient for Phase 5.1.
- Case ID derives from submission_id for determinism.
