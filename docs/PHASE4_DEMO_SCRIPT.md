# Phase 4 Verifier Demo Script (E2E)

## Backend local

```powershell
$env:ENV="ci"; $env:APP_ENV="dev"
Set-Location backend
C:/Python314/python.exe -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
```

## Seed verifier cases

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8001/api/ops/seed-verifier-cases -Body "{}" -ContentType "application/json"
```

## List cases + pick a case_id

```powershell
Invoke-RestMethod http://127.0.0.1:8001/api/verifier/cases?limit=10
```

## Add note + action

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8001/api/verifier/cases/<id>/notes -Body (@{ text="demo note"; actor="demo" } | ConvertTo-Json) -ContentType "application/json"
Invoke-RestMethod -Method Post http://127.0.0.1:8001/api/verifier/cases/<id>/actions -Body (@{ type="triage"; actor="demo"; payload=@{ severity="low" } } | ConvertTo-Json -Depth 5) -ContentType "application/json"
```

## Export packet artifacts

```powershell
Invoke-WebRequest http://127.0.0.1:8001/api/verifier/cases/<id>/packet.pdf -OutFile .\demo_packet.pdf
Invoke-WebRequest http://127.0.0.1:8001/api/verifier/cases/<id>/audit.zip -OutFile .\demo_audit.zip
```

## Finalize approve + verify snapshot

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8001/api/verifier/cases/<id>/decision -Body (@{ type="approve"; reason="demo"; actor="demo" } | ConvertTo-Json) -ContentType "application/json"
Invoke-RestMethod http://127.0.0.1:8001/api/verifier/cases/<id>/final-packet
```

## One-shot smoke

```powershell
Invoke-RestMethod http://127.0.0.1:8001/api/ops/verifier-smoke/run | ConvertTo-Json -Depth 20
```
