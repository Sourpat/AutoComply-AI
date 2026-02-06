# CI Failure Playbook (RC Gate)

Use this playbook when the RC Gate workflow fails.

## 1) Find the failing step

- GitHub → Actions → RC Gate
- Open the newest run
- Job: rc
- Identify the failing step

## 2) Common failure buckets

- Backend tests (pytest)
- Ops smoke / golden suite
- Knowledge pack mode (kp-v1)
- Frontend build / Vite

## 3) Logs and artifacts to check

- Job Summary tail (Pytest failure summary)
- Step logs for the failing step
- Uploaded artifacts (backend-logs) when present

## 4) Local repro (PowerShell)

```powershell
Set-Location backend
$env:ENV = "ci"
$env:APP_ENV = "dev"
python -m pytest -q
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts/rc_smoke.ps1
```

## 5) Last-resort quick debug prints

If you need more CI visibility, add temporary non-blocking diagnostics:

- `pip freeze | head -200`
- `python -c "import os; print({k:v for k,v in os.environ.items() if k in ['ENV','APP_ENV','KNOWLEDGE_MODE']})"`
- Route dump: `python -c "from src.api.main import app; print('\n'.join(sorted({r.path for r in app.routes})))"`