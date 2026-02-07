# Phase 4 Plan — Verifier Console uses real submitted cases

## Problem statement
The Verifier Console currently relies on mock or placeholder data. Phase 4 will connect it to real submitted cases with deterministic seeding and clear API contracts.

## In-scope
- Verifier cases list endpoint with filter/sort/pagination
- Verifier case detail endpoint with latest explain run + citations metadata
- Deterministic seed data (10 demo cases)
- Frontend wiring for Verifier Console tabs
- API contract tests for list/detail
- Demo script + architecture note

## Out-of-scope
- UI redesigns outside Verifier Console
- New persistence layers or DB migrations beyond required fields
- Changes to ports (backend stays on 8001)

## API endpoints
- GET /api/verifier/cases
- GET /api/verifier/cases/{case_id}

## Minimal data model
- Case: id, title, summary, decisionType, status, createdAt, updatedAt
- Explain: run_id, knowledge_version, citations_count, last_computed_at
- Pagination: limit, offset, total

## Milestones
- 4.1: Backend case persistence + list/detail endpoints
- 4.2: Deterministic seed + fixtures
- 4.3: Frontend wiring + API contract tests
- 4.4: Docs and demo script

## Definition of done
- Verifier Console pulls real cases from backend
- List/detail endpoints return contract-compliant payloads
- Deterministic seed produces 10 demo cases
- Tests pass for list/detail endpoints
- Smoke checklist passes (see PHASE4_SMOKE.md)
