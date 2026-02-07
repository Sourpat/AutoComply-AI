# Phase 5 Smoke Checklist — Submitter to Verifier

## Backend smoke (local)
```powershell
Set-Location backend
C:/Python314/python.exe -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

## Create submitter submission
```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8001/api/submitter/submissions -Body (@{
  subject="Demo submission";
  submitter_name="Demo";
  jurisdiction="OH";
  doc_type="csf_facility";
  notes="Demo notes";
  client_token="demo-token"
} | ConvertTo-Json) -ContentType "application/json"
```

## Verify verifier case
```powershell
Invoke-RestMethod http://127.0.0.1:8001/api/verifier/cases?limit=10
```

## Fetch submission payload
```powershell
Invoke-RestMethod http://127.0.0.1:8001/api/verifier/cases/<case_id>/submission
```

## Frontend build
```powershell
Set-Location frontend
npm run build
```
