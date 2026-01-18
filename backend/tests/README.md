# Backend Tests

## Test DB Isolation
All tests run against an isolated SQLite database created per test session. The session database path is set via environment variables (`DB_PATH`, `DATABASE_URL`) in `backend/tests/conftest.py`, and the schema is initialized with `init_db()`.

Tables are cleared between tests to prevent cross-test collisions.

## Running Core Suite (default)
```
.\.venv\Scripts\python.exe -m pytest -q
```

## Running Legacy Suite
Legacy tests live in `backend/tests/legacy` and are excluded by default.

```
.\.venv\Scripts\python.exe -m pytest -q backend/tests/legacy
```
