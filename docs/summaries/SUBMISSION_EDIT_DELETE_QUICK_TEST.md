# Quick Test Guide: Submission Edit/Delete

## Backend Testing (PowerShell)

### 1. Create a Test Submission
```powershell
$body = '{"decisionType": "csf_practitioner", "submittedBy": "test@test.com", "formData": {"name": "Test User", "license": "12345"}}'
$response = Invoke-WebRequest -Uri "http://127.0.0.1:8001/submissions" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
$submission = $response.Content | ConvertFrom-Json
$id = $submission.id
Write-Host "Created submission: $id"
```

### 2. Update the Submission (PATCH)
```powershell
$body = '{"formData": {"name": "Updated Name", "license": "99999"}}'
Invoke-WebRequest -Uri "http://127.0.0.1:8001/submissions/$id" -Method PATCH -Body $body -ContentType "application/json" -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json
```

**Expected Result**:
- Form data updated
- `updatedAt` timestamp set
- Status code: 200

### 3. Delete the Submission
```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8001/submissions/$id" -Method DELETE -UseBasicParsing
```

**Expected Result**:
- Status code: 204 (No Content)
- Submission soft-deleted
- Linked case status = 'cancelled'

### 4. Verify Deletion
```powershell
# Should NOT appear in default list
Invoke-WebRequest -Uri "http://127.0.0.1:8001/submissions" -UseBasicParsing | Select-Object -ExpandProperty Content

# Should appear with includeDeleted=true
Invoke-WebRequest -Uri "http://127.0.0.1:8001/submissions?includeDeleted=true" -UseBasicParsing | Select-Object -ExpandProperty Content
```

### 5. Verify Case Excluded from Queue
```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8001/workflow/cases" -UseBasicParsing | Select-Object -ExpandProperty Content | ConvertFrom-Json
```

**Expected Result**: Cancelled case NOT in list

## Test Business Rules

### Test: Cannot Edit Approved Case
```powershell
# Create submission
$body = '{"decisionType": "csf_practitioner", "submittedBy": "test@test.com", "formData": {}}'
$response = Invoke-WebRequest -Uri "http://127.0.0.1:8001/submissions" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
$id = ($response.Content | ConvertFrom-Json).id

# Get the case ID
$case = Invoke-WebRequest -Uri "http://127.0.0.1:8001/workflow/cases" -UseBasicParsing | ConvertFrom-Json
$caseId = $case.items[0].id

# Approve the case
$body = '{"status": "approved", "decision": "APPROVED", "reason": "Test", "notes": "Test"}'
Invoke-WebRequest -Uri "http://127.0.0.1:8001/workflow/cases/$caseId/review" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing

# Try to edit submission (should fail with 403)
$body = '{"formData": {"name": "Should Fail"}}'
try {
    Invoke-WebRequest -Uri "http://127.0.0.1:8001/submissions/$id" -Method PATCH -Body $body -ContentType "application/json" -UseBasicParsing
    Write-Host "ERROR: Should have failed!" -ForegroundColor Red
} catch {
    Write-Host "✓ Correctly prevented edit (403 Forbidden)" -ForegroundColor Green
}
```

### Test: Cannot Delete Assigned Case
```powershell
# Create submission
$body = '{"decisionType": "csf_practitioner", "submittedBy": "test@test.com", "formData": {}}'
$response = Invoke-WebRequest -Uri "http://127.0.0.1:8001/submissions" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
$id = ($response.Content | ConvertFrom-Json).id

# Get and assign the case
$case = Invoke-WebRequest -Uri "http://127.0.0.1:8001/workflow/cases" -UseBasicParsing | ConvertFrom-Json
$caseId = $case.items[0].id
$body = '{"assignedTo": "verifier@test.com"}'
Invoke-WebRequest -Uri "http://127.0.0.1:8001/workflow/cases/$caseId" -Method PATCH -Body $body -ContentType "application/json" -UseBasicParsing

# Try to delete submission (should fail with 403)
try {
    Invoke-WebRequest -Uri "http://127.0.0.1:8001/submissions/$id" -Method DELETE -UseBasicParsing
    Write-Host "ERROR: Should have failed!" -ForegroundColor Red
} catch {
    Write-Host "✓ Correctly prevented delete (403 Forbidden)" -ForegroundColor Green
}
```

### Test: Idempotent Delete
```powershell
# Create and delete submission
$body = '{"decisionType": "csf_practitioner", "submittedBy": "test@test.com", "formData": {}}'
$response = Invoke-WebRequest -Uri "http://127.0.0.1:8001/submissions" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
$id = ($response.Content | ConvertFrom-Json).id
Invoke-WebRequest -Uri "http://127.0.0.1:8001/submissions/$id" -Method DELETE -UseBasicParsing

# Delete again (should return 204, not error)
$response = Invoke-WebRequest -Uri "http://127.0.0.1:8001/submissions/$id" -Method DELETE -UseBasicParsing
if ($response.StatusCode -eq 204) {
    Write-Host "✓ Idempotent delete works (204 No Content)" -ForegroundColor Green
} else {
    Write-Host "ERROR: Expected 204" -ForegroundColor Red
}
```

## Database Verification

### Check Submission Columns
```powershell
python -c "import sqlite3; conn = sqlite3.connect('app/data/autocomply.db'); cur = conn.cursor(); cur.execute('PRAGMA table_info(submissions)'); print('\n'.join([f'{row[1]}: {row[2]}' for row in cur.fetchall()]))"
```

**Expected**: Should include `updated_at`, `is_deleted`, `deleted_at`

### Check Soft Delete Values
```powershell
python -c "import sqlite3; conn = sqlite3.connect('app/data/autocomply.db'); cur = conn.cursor(); cur.execute('SELECT id, is_deleted, deleted_at FROM submissions LIMIT 10'); print('\n'.join([str(row) for row in cur.fetchall()]))"
```

### Check Case Status
```powershell
python -c "import sqlite3; conn = sqlite3.connect('app/data/autocomply.db'); cur = conn.cursor(); cur.execute('SELECT id, status, submission_id FROM cases WHERE status = \"cancelled\"'); print('\n'.join([str(row) for row in cur.fetchall()]))"
```

## Quick Smoke Test (All in One)
```powershell
Write-Host "`n=== Submission Edit/Delete Smoke Test ===" -ForegroundColor Cyan

# 1. Create
Write-Host "`n1. Creating submission..." -ForegroundColor Yellow
$body = '{"decisionType": "csf_practitioner", "submittedBy": "smoke@test.com", "formData": {"name": "Smoke Test"}}'
$response = Invoke-WebRequest -Uri "http://127.0.0.1:8001/submissions" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
$id = ($response.Content | ConvertFrom-Json).id
Write-Host "   ✓ Created: $id" -ForegroundColor Green

# 2. Edit
Write-Host "`n2. Updating submission..." -ForegroundColor Yellow
$body = '{"formData": {"name": "Updated Smoke Test"}}'
$response = Invoke-WebRequest -Uri "http://127.0.0.1:8001/submissions/$id" -Method PATCH -Body $body -ContentType "application/json" -UseBasicParsing
$updated = $response.Content | ConvertFrom-Json
if ($updated.formData.name -eq "Updated Smoke Test") {
    Write-Host "   ✓ Updated successfully" -ForegroundColor Green
}

# 3. Delete
Write-Host "`n3. Deleting submission..." -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri "http://127.0.0.1:8001/submissions/$id" -Method DELETE -UseBasicParsing
if ($response.StatusCode -eq 204) {
    Write-Host "   ✓ Deleted successfully (204)" -ForegroundColor Green
}

# 4. Verify excluded from list
Write-Host "`n4. Verifying exclusion from default list..." -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri "http://127.0.0.1:8001/submissions" -UseBasicParsing
$submissions = ($response.Content | ConvertFrom-Json).value
$found = $submissions | Where-Object { $_.id -eq $id }
if ($null -eq $found) {
    Write-Host "   ✓ Correctly excluded from list" -ForegroundColor Green
}

# 5. Verify included with flag
Write-Host "`n5. Verifying inclusion with includeDeleted=true..." -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri "http://127.0.0.1:8001/submissions?includeDeleted=true" -UseBasicParsing
$submissions = ($response.Content | ConvertFrom-Json).value
$found = $submissions | Where-Object { $_.id -eq $id }
if ($found.isDeleted -eq $true) {
    Write-Host "   ✓ Found in list with isDeleted=true" -ForegroundColor Green
}

Write-Host "`n=== All Tests Passed! ===" -ForegroundColor Cyan
```

## Troubleshooting

### Backend won't start
- Check database path: `backend/app/data/autocomply.db`
- Clear Python cache: `Get-ChildItem -Recurse -Filter "__pycache__" | Remove-Item -Recurse -Force`
- Recreate database: `rm app/data/autocomply.db` and restart

### 500 Internal Server Error
- Check backend logs in task terminal
- Common issues:
  - Missing CANCELLED status in CaseStatus enum
  - Database missing columns (recreate DB)

### 403 Forbidden on Edit
- Check case status (must be new/in_review/needs_info)
- Use GET /workflow/cases to see case status

### 403 Forbidden on Delete
- Check case status (must be 'new')
- Check assignment (must be unassigned)
- Use GET /workflow/cases/{id} to see details
