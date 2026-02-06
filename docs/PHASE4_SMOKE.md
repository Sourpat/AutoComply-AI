# Phase 4 Smoke Checklist — Verifier Console

## Backend start
```powershell
Set-Location backend
C:/Python314/python.exe -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

## Seed demo data
```powershell
# Use the Phase 4 seed command once implemented
# C:/Python314/python.exe scripts/seed_phase4_verifier_cases.py
```

## Verify endpoints
```powershell
Invoke-RestMethod http://127.0.0.1:8001/api/verifier/cases
```

```powershell
Invoke-RestMethod http://127.0.0.1:8001/api/verifier/cases/{case_id}
```

## Frontend build
```powershell
Set-Location frontend
npm run build
```

## Optional: RC smoke
```powershell
powershell -ExecutionPolicy Bypass -File scripts/rc_smoke.ps1
```
