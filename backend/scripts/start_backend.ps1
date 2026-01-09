Set-Location (Split-Path $PSScriptRoot -Parent)

if (Test-Path ".\.venv\Scripts\Activate.ps1") {
  . .\.venv\Scripts\Activate.ps1
}

$env:PYTHONPATH = "$PWD\src"
$BindHost = "127.0.0.1"
$Port = 8000

python -m uvicorn src.api.main:app --reload --host $BindHost --port $Port
