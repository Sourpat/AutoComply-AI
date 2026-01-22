# Decision Log

**Purpose:** Record architectural and implementation decisions with full context for future reference.

**Format per decision:**
- **Date:** YYYY-MM-DD
- **Decision:** Clear statement of what was decided
- **Context:** Why this decision was needed
- **Options considered:** Alternative approaches evaluated
- **Tradeoffs:** Pros and cons of chosen approach
- **Outcome:** Expected result or current status
- **Follow-ups:** Action items or future work triggered by this decision

---

## Decisions

### 2026-01-21: Adopt lightweight JSON trace persistence first, OTEL later if needed

**Decision:** Implement custom JSON-based trace persistence in SQLite/PostgreSQL before considering OpenTelemetry integration.

**Context:**
- Need enterprise-grade observability for AI decision workflows
- Existing repo uses SQLite/PostgreSQL with SQLModel/Pydantic
- Want to minimize risk and external dependencies
- OTEL adds complexity and may not fit current deployment model

**Options considered:**
1. **OpenTelemetry from day 1:** Full OTEL collector + export to Phoenix/Langsmith
   - Pros: Industry standard, rich ecosystem, vendor flexibility
   - Cons: Complex setup, additional infra (collector), learning curve, overkill for current scale
   
2. **Lightweight JSON traces in existing DB** (CHOSEN)
   - Pros: Zero new infra, reuses existing patterns, faster iteration, simple queries
   - Cons: Limited to single-DB queries, no distributed tracing (not needed yet)
   
3. **SaaS-only (Langsmith/Phoenix Cloud):**
   - Pros: Turnkey solution, no infra management
   - Cons: Vendor lock-in, data privacy concerns, recurring cost

**Tradeoffs:**
- **Chosen approach:** Maximum control, minimal risk, fits existing stack
- **Deferred:** OTEL integration can be added later as an export layer without changing trace schema

**Outcome:**
- Trace DB schema defined with JSON fields for flexibility
- API endpoints for trace read/write/query
- UI integration to display traces in existing verifier/review interfaces
- OTEL remains optional future enhancement (see parking lot)

**Follow-ups:**
- Add OTEL export layer if multi-service tracing becomes needed (P3)
- Evaluate Phoenix/Langsmith integration after basic traces are working (P3)
- Monitor trace DB size and consider archival strategy at 10K+ traces (P2)
