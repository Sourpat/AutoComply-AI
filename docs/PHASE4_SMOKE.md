# Phase 4 Smoke Checklist — Verifier Console

**Status**: PASS (RC Gate — 2026-02-06)

See the full demo script in docs/PHASE4_DEMO_SCRIPT.md.

## Backend start
```powershell
Set-Location backend
C:/Python314/python.exe -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

## Seed demo data
```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8001/api/ops/seed-verifier-cases
```

## Verify endpoints
```powershell
Invoke-RestMethod http://127.0.0.1:8001/api/verifier/cases
```

```powershell
Invoke-RestMethod http://127.0.0.1:8001/api/verifier/cases/case-001
```

## Frontend build
```powershell
Set-Location frontend
npm run build
```

## Frontend UI verification
1. Open http://localhost:5173/console/cases
2. Verify list loads and shows case rows (case_id, status, jurisdiction, created_at, summary)
3. Use Status and Jurisdiction filters → list updates
4. Click a case → detail panel shows fields + recent events
5. If list is empty in dev, use “Seed demo cases” CTA → list populates
6. Add a note → note appears and event appears in timeline
7. Toggle My Queue → empty, then Assign to me → toggle My Queue → case appears
8. Select 3 cases → bulk Needs review → statuses update and events appear (locked cases skipped)
9. Click Finalize decision → choose Approve → case locks and decision appears in timeline
10. Open another case → Finalize decision → Request info → status moves to needs_info and remains editable
11. Open Decision Packet panel → Overview + Evidence tabs load
12. Export JSON → decision-packet-<id>.json downloads with citations
13. Export PDF → decision-packet-<id>.pdf downloads (finalization included when locked)
14. Download Audit ZIP → contains decision-packet json/pdf, citations.json, timeline.json, README.txt

## Optional: RC smoke
```powershell
powershell -ExecutionPolicy Bypass -File scripts/rc_smoke.ps1
```
