# Architecture Decision Record (ADR)

**Purpose**: Log significant technical decisions made during development to provide context for future changes.

---

## Template (Use for New Decisions)

```markdown
## [YYYY-MM-DD] Decision Title

**Context**: What problem or question prompted this decision?

**Decision**: What did we decide to do?

**Rationale**: Why did we choose this approach?

**Alternatives Considered**:
- Option 1: Why rejected
- Option 2: Why rejected

**Consequences**:
- Positive: Benefits of this decision
- Negative: Tradeoffs or limitations
- Neutral: Other impacts

**Status**: Proposed | Accepted | Superseded

**Related**:
- Commit: abc1234
- Tasks: T-042
- Docs: PHASE_X.md
```

---

## Decisions

### [2026-01-31] Add audit packet verification + local share links

**Context**: Verifiers need to validate packet integrity and share audit packets without backend persistence.

**Decision**: Add /audit/verify for hash verification using canonicalization rules and /audit/view for local share links backed by localStorage. Share links only contain IDs + packetHash.

**Rationale**:
- Maintains deterministic hashing rules
- Avoids backend changes while enabling sharing on same device
- Keeps audit verification explicit and repeatable

**Alternatives Considered**:
- Server-side packet storage: Deferred (requires backend)
- Embedding full packet in URL: Rejected (too large)

**Consequences**:
- Positive: Clear verification UX + local sharing
- Negative: Links only work on same device
- Neutral: Backend unchanged

**Status**: Accepted

**Related**:
- Tasks: T-006
- Area: audit packet UX

### [2026-01-30] Add PDF export + SHA-256 integrity hash for audit packets

**Context**: Verifiers need audit-grade exportability and integrity validation for agentic decisions.

**Decision**: Implement client-side PDF export using pdf-lib and compute a SHA-256 hash over a canonicalized audit packet (stable key ordering, excluding non-deterministic fields like generated timestamps). Display the hash in the UI and include it in JSON/PDF exports.

**Rationale**:
- Keeps audit exports deterministic and verifiable
- Avoids backend changes while enabling integrity checks
- Leverages lightweight client-side PDF generation

**Alternatives Considered**:
- Server-side PDF generation: Rejected (not required yet)
- Hash raw JSON with timestamps: Rejected (non-deterministic)

**Consequences**:
- Positive: Audit-grade exports with integrity signature
- Negative: Client-side PDF size limited by browser memory
- Neutral: Backend contracts unchanged

**Status**: Accepted

**Related**:
- Tasks: T-005
- Area: audit packet export

### [2026-01-30] Launch Agentic Workbench with JSON audit packet export

**Context**: Verifiers need a dedicated workbench with audit-grade traceability and exportable audit packets without changing backend semantics.

**Decision**: Add a new Agentic Workbench route with left/center/right panels, evidence viewer backed by localStorage, and JSON export. PDF export is intentionally stubbed for a future iteration.

**Rationale**:
- Delivers verifier-grade UX quickly without backend changes
- Keeps deterministic contracts intact
- Enables immediate audit packet export while deferring PDF complexity

**Alternatives Considered**:
- New backend export endpoint: Rejected (not required yet)
- Full PDF export now: Deferred (needs separate design + tooling)

**Consequences**:
- Positive: Premium audit UX with traceability and export
- Negative: PDF export still pending
- Neutral: No backend changes required

**Status**: Accepted

**Related**:
- Tasks: T-004
- Area: agentic workbench

### [2026-01-30] Agentic explainability via per-action drawer

**Context**: The agentic UI needs premium explainability without redesigning the layout or altering backend behavior.

**Decision**: Add a per-action “Why?” dialog that summarizes plan reasoning, rule outcomes, and trace metadata, with a copyable trace payload.

**Rationale**:
- Keeps explainability colocated with actions
- Avoids major layout changes while improving trust
- Uses existing trace data without backend changes

**Alternatives Considered**:
- Dedicated full-page explainability view: Rejected (too broad)
- Inline expanded trace JSON: Rejected (too noisy for primary action UI)

**Consequences**:
- Positive: Clear, on-demand explanations and audit-friendly copy
- Negative: Adds one more modal interaction
- Neutral: No backend changes required

**Status**: Accepted

**Related**:
- Tasks: T-003
- Area: agentic UI

### [2026-01-28] Adopt shadcn/ui tokens + app shell for premium UI

**Context**: The web UI needs a premium, modern treatment with consistent typography, spacing, and component styling while keeping existing business logic intact.

**Decision**: Introduce shadcn/ui primitives, tokenized theme variables, and a standard app shell (header, left nav, content container) while refactoring key pages to use shared components and subtle motion.

**Rationale**:
- Provides consistent visual hierarchy and spacing
- Enables dark mode with minimal code
- Keeps UI refactor scoped to presentation layer

**Alternatives Considered**:
- Custom CSS-only refactor: Rejected (harder to maintain consistency)
- Full UI redesign: Rejected (too broad for current scope)

**Consequences**:
- Positive: Premium look and reusable primitives
- Negative: Added frontend dependencies (Radix + sonner + framer-motion)
- Neutral: Business logic remains unchanged

**Status**: Accepted

**Related**:
- Tasks: T-001
- Area: frontend UI

---

### [2026-01-30] Add deterministic agentic workflow scaffold

**Context**: Need a first-class agentic workflow layer that is deterministic, auditable, and UI-actionable without breaking existing routes.

**Decision**: Add a shared contract plus a new agentic API that returns deterministic plans and actions. Persist agentic state in a new dedicated table to avoid altering existing case flows.

**Rationale**:
- Keeps agent behavior deterministic with explicit actions and schemas
- Provides auditable traces per response
- Isolated persistence avoids breaking current case workflows

**Alternatives Considered**:
- Reusing existing case status: Rejected (semantics differ)
- In-memory state only: Rejected (not persistent)

**Consequences**:
- Positive: Clear, testable plan/action contract
- Negative: Adds a new table and API surface area
- Neutral: Existing endpoints unchanged

**Status**: Accepted

**Related**:
- Tasks: T-001
- Area: agentic workflow

### [2026-01-22] Use Dict[str, Any] for PaginatedCasesResponse items

**Context**: Phase 7.29 added computed SLA fields (age_hours, sla_status) to case objects, but PaginatedCasesResponse used `List[CaseRecord]` which stripped these fields during Pydantic validation.

**Decision**: Changed `items: List[CaseRecord]` to `items: List[Dict[str, Any]]` in PaginatedCasesResponse model.

**Rationale**:
- Allows dynamic computed fields to pass through API response
- Avoids adding fields to base CaseRecord model (keeps it clean)
- Minimal change to existing codebase
- Preserves backward compatibility (dict is superset of model)

**Alternatives Considered**:
- Add age_hours/sla_status to CaseRecord: Rejected (pollutes base model, not always computed)
- Create CaseRecordWithSLA model: Rejected (too much duplication)
- Use response_model_exclude_unset: Rejected (doesn't help with missing fields)

**Consequences**:
- Positive: Flexible schema for computed fields, easy to extend
- Negative: Lose Pydantic validation on response items (rely on dict structure)
- Neutral: Frontend still gets typed interfaces via TypeScript

**Status**: Accepted

**Related**:
- Commit: 075c245
- Issue: Console "Backend Not Reachable" P0 fix
- File: backend/app/workflow/router.py

---

### [2026-01-22] Store trace labels in trace_metadata_json

**Context**: Phase 8.2 requires human labeling of traces (open codes, category, pass/fail, severity, notes) without adding new database tables.

**Decision**: Store labels in root span's `trace_metadata_json` field under `__labels` key.

**Rationale**:
- No schema migration needed
- Labels are semantically part of trace metadata
- Atomic updates with trace data
- Easy retrieval in single query

**Alternatives Considered**:
- New trace_labels table: Rejected (violates WIP=1 constraint, requires migration)
- Separate JSON column: Rejected (unnecessary complexity)
- Store in notes field: Rejected (not structured, hard to query)

**Consequences**:
- Positive: Zero migration cost, simple implementation
- Negative: Can't query labels efficiently (no indexed columns)
- Neutral: Labels are read-heavy, query performance acceptable for MVP

**Status**: Accepted

**Related**:
- Commit: 920c558
- Phase: 8.2 Trace Viewer with Labeling
- File: backend/src/api/routes/traces.py

---

### [2026-01-16] Use timezone-aware datetimes with UTC default

**Context**: SLA computation was crashing due to mixing timezone-naive and timezone-aware datetime objects.

**Decision**: All datetime comparisons must use timezone-aware objects. If input is naive, assume UTC and add `tzinfo=timezone.utc`.

**Rationale**:
- Python datetime subtraction requires both operands to have same timezone awareness
- UTC is standard for server-side timestamps
- Prevents future timezone bugs
- Minimal code change (add 2-line check)

**Alternatives Considered**:
- Make everything timezone-naive: Rejected (loses DST handling, not best practice)
- Convert to naive before comparison: Rejected (error-prone, hides issues)
- Use pytz library: Rejected (overkill for UTC-only requirement)

**Consequences**:
- Positive: Robust datetime handling, prevents 500 errors
- Negative: Assumes UTC for naive inputs (acceptable for this app)
- Neutral: Existing data unaffected (SQLite stores as text)

**Status**: Accepted

**Related**:
- Commit: 075c245
- Issue: Cases list 500 error
- File: backend/app/workflow/sla.py

---

## Superseded Decisions

*(Move obsolete decisions here when replaced by newer decisions)*

---

## Decision Process

1. **Identify**: Recognize when a decision has long-term architectural impact
2. **Document**: Use template above to record decision while context is fresh
3. **Review**: Share with team/user if decision affects roadmap or UX
4. **Commit**: Include ADR update in same commit as implementation
5. **Reference**: Link to decision from code comments if non-obvious

**What to Document**:
- Data model choices
- API design patterns
- Technology selections
- Performance tradeoffs
- Security approaches
- Major refactorings

**What NOT to Document**:
- Routine bug fixes
- Code formatting choices
- Dependency version bumps
- Obvious implementation details
