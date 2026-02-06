# Phase 4 Smoke Checklist — Verifier Console

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
6. Click Approve/Reject/Needs review → status updates and event appears
7. Add a note → note appears and event appears in timeline
8. Toggle My Queue → empty, then Assign to me → toggle My Queue → case appears
9. Select 3 cases → bulk Needs review → statuses update and events appear

## Optional: RC smoke
```powershell
powershell -ExecutionPolicy Bypass -File scripts/rc_smoke.ps1
```
