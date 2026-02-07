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

## Upload submission attachment
```powershell
$filePath = "$PWD\\sample-attachment.txt"
"Demo attachment" | Set-Content -Path $filePath

$form = New-Object System.Net.Http.MultipartFormDataContent
$fileStream = [System.IO.File]::OpenRead($filePath)
$fileContent = New-Object System.Net.Http.StreamContent($fileStream)
$fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("text/plain")
$form.Add($fileContent, "file", "sample-attachment.txt")

$uploadResponse = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8001/api/submissions/<submission_id>/attachments -Body $form
$fileStream.Dispose()
$uploadResponse
```

## List verifier attachments
```powershell
Invoke-RestMethod http://127.0.0.1:8001/api/verifier/cases/<case_id>/attachments
```

## Download verifier attachment
```powershell
Invoke-WebRequest http://127.0.0.1:8001/api/verifier/attachments/<attachment_id>/download -OutFile downloaded-attachment.txt
```

## Download audit ZIP + inspect manifest
```powershell
Invoke-WebRequest http://127.0.0.1:8001/api/verifier/cases/<case_id>/audit.zip -OutFile audit-packet.zip
Expand-Archive -Path audit-packet.zip -DestinationPath audit-packet
Get-Content audit-packet/manifest.json
Get-ChildItem audit-packet/evidence
```

## Frontend build
```powershell
Set-Location frontend
npm run build
```
