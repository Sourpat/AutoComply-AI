# Verification Work Event Contract

## Purpose

The **Verification Work Event** contract provides a unified representation of verification workload across different AutoComply AI modules:

- **Chat HITL** - Human-in-the-loop review for compliance Q&A
- **CSF Submissions** - Controlled Substance Form verification
- **License Checks** - License compliance verification
- **System Exceptions** - System-level verification needs

This contract enables:
- ✅ Standardized workload tracking and metrics aggregation
- ✅ Unified Ops Dashboard views across all verification sources
- ✅ Clear routing to appropriate execution surfaces (Review Queue vs Compliance Console)
- ✅ SLA monitoring and backlog aging calculations
- ✅ Risk-based prioritization

**Does NOT change:** Existing decisioning logic, data models, or backend behavior.

---

## Contract Interface

```typescript
interface VerificationWorkEvent {
  id: string;                 // Stable identifier, e.g. "chat:7" or "csf:12345"
  source: VerificationSource; // CHAT | CSF | LICENSE | SYSTEM
  status: VerificationWorkStatus; // OPEN | IN_REVIEW | RESOLVED | PUBLISHED | BLOCKED
  risk: RiskLevel;            // LOW | MEDIUM | HIGH
  created_at: string;         // ISO 8601 timestamp
  updated_at?: string;        // ISO 8601 timestamp (optional)
  jurisdiction?: string;      // "CA", "OH", etc.
  reason_code?: string;       // Standardized uppercase snake_case
  title: string;              // Short label for list rows (max 60 chars)
  summary?: string;           // Longer description
  link?: {
    label: string;
    href: string;             // Where to execute this work
  };
  artifact?: {
    type: "CHAT_QUESTION" | "CSF_SUBMISSION" | "LICENSE_CHECK" | "SYSTEM_EXCEPTION";
    artifact_id?: string;
  };
  trace?: {
    trace_id?: string;
    queue_item_id?: number | string;
  };
  metrics?: {
    age_hours?: number;
    sla_bucket?: "UNDER_4H" | "UNDER_24H" | "OVER_24H";
  };
}
```

---

## Surfaces

### Consumer Surfaces (Read/Aggregate)

**Ops Dashboard** (`/admin/ops`)
- Aggregates events by source
- Shows workload counts, risk distribution, SLA buckets
- Provides quick navigation to execution surfaces

### Execution Surfaces (Work Performed Here)

**Chat Review Queue** (`/admin/review`)
- Handles `CHAT` source events
- Item-level Q&A review and approval
- Publishes to knowledge base

**Compliance Console** (`/console`)
- Handles `CSF` and `LICENSE` source events
- Artifact-level verification (forms, licenses)
- Decision tracing and audit trails

---

## Example Events

### CHAT Event

```json
{
  "id": "chat:42",
  "source": "CHAT",
  "status": "OPEN",
  "risk": "MEDIUM",
  "created_at": "2025-12-25T10:30:00Z",
  "jurisdiction": "OH",
  "reason_code": "LOW_SIMILARITY",
  "title": "What are the storage requirements for Schedule II drugs?",
  "summary": "What are the storage requirements for Schedule II drugs in Ohio hospital pharmacies?",
  "link": {
    "label": "Open in Chat Review Queue",
    "href": "/admin/review/42"
  },
  "artifact": {
    "type": "CHAT_QUESTION",
    "artifact_id": "42"
  },
  "trace": {
    "queue_item_id": 42
  },
  "metrics": {
    "age_hours": 3.5,
    "sla_bucket": "UNDER_4H"
  }
}
```

### CSF Event

```json
{
  "id": "csf:abc-123",
  "source": "CSF",
  "status": "OPEN",
  "risk": "HIGH",
  "created_at": "2025-12-25T08:00:00Z",
  "jurisdiction": "CA",
  "reason_code": "JURISDICTION_MISMATCH",
  "title": "Hospital CSF • Riverside General Hospital",
  "summary": "Hospital CSF submission for California requires additional verification",
  "link": {
    "label": "Open in Compliance Console",
    "href": "/console"
  },
  "artifact": {
    "type": "CSF_SUBMISSION",
    "artifact_id": "abc-123"
  },
  "trace": {
    "trace_id": "trace-xyz-789"
  },
  "metrics": {
    "age_hours": 26.5,
    "sla_bucket": "OVER_24H"
  }
}
```

### LICENSE Event

```json
{
  "id": "license:tddd-456",
  "source": "LICENSE",
  "status": "BLOCKED",
  "risk": "HIGH",
  "created_at": "2025-12-24T14:00:00Z",
  "jurisdiction": "OH",
  "reason_code": "LICENSE_EXPIRED",
  "title": "Ohio TDDD • XYZ Pharmacy",
  "summary": "Ohio Terminal Distributor license verification failed - expired",
  "link": {
    "label": "Open in Compliance Console",
    "href": "/license"
  },
  "artifact": {
    "type": "LICENSE_CHECK",
    "artifact_id": "tddd-456"
  },
  "trace": {
    "trace_id": "trace-lic-001"
  },
  "metrics": {
    "age_hours": 44.0,
    "sla_bucket": "OVER_24H"
  }
}
```

---

## Usage

### Mapping Chat Items

```typescript
import { fromChatReviewItem } from './contracts/verificationWorkEvent';

// Convert existing chat review items to events
const chatEvents = chatReviewItems.map(fromChatReviewItem);

// Aggregate for dashboard
import { aggregateBySource } from './contracts/verificationWorkEvent';
const workloadBySource = aggregateBySource(chatEvents);

console.log(workloadBySource.CHAT.open); // Open chat items
console.log(workloadBySource.CHAT.high_risk); // High-risk chat items
```

### Mapping CSF Items (Future)

```typescript
import { fromCSFArtifact } from './contracts/verificationWorkEvent';

// TODO: Wire up when CSF verification queue is available
const csfEvents = csfArtifacts.map(fromCSFArtifact);
```

### Mapping License Items (Future)

```typescript
import { fromLicenseArtifact } from './contracts/verificationWorkEvent';

// TODO: Wire up when License verification queue is available
const licenseEvents = licenseArtifacts.map(fromLicenseArtifact);
```

---

## Standardized Reason Codes

The contract normalizes reason codes to uppercase snake_case:

| Input | Normalized |
|-------|------------|
| `"low similarity"` | `"LOW_SIMILARITY"` |
| `"jurisdiction mismatch"` | `"JURISDICTION_MISMATCH"` |
| `"unsafe_request"` | `"UNSAFE_REQUEST"` |
| `"system_error"` | `"SYSTEM_ERROR"` |
| `"no_kb_match"` | `"NO_KB_MATCH"` |

Unknown codes are automatically converted to uppercase snake_case format.

---

## Risk Inference

Risk levels are automatically inferred from reason codes:

- **HIGH**: `JURISDICTION_MISMATCH`, `UNSAFE_REQUEST`
- **MEDIUM**: `LOW_SIMILARITY`, `SYSTEM_ERROR`, `NO_KB_MATCH`
- **LOW**: All other codes

---

## SLA Buckets

Age metrics are automatically calculated from `created_at`:

- **UNDER_4H**: Created less than 4 hours ago
- **UNDER_24H**: Created 4-24 hours ago
- **OVER_24H**: Created more than 24 hours ago

---

## Current Integration Status

| Module | Status | Mapper | Execution Surface |
|--------|--------|--------|-------------------|
| **Chat HITL** | ✅ **Wired** | `fromChatReviewItem()` | Chat Review Queue (`/admin/review`) |
| **CSF** | 🚧 **Stub** | `fromCSFArtifact()` | Compliance Console (`/console`) |
| **License** | 🚧 **Stub** | `fromLicenseArtifact()` | Compliance Console (`/license`) |
| **System** | ⏳ **Not Started** | N/A | TBD |

---

## Future Enhancements

1. **CSF Verification Queue**: Wire up CSF submission events when CSF verification queue is built
2. **License Verification Queue**: Wire up license check events when license queue is available
3. **Unified Work Events API**: Backend endpoint to fetch all events in contract format
4. **Real-time Updates**: WebSocket or polling for live workload updates
5. **Advanced Filtering**: Filter events by source, status, risk, jurisdiction in Ops Dashboard
6. **Drill-down Views**: Click workload cards to see filtered event lists

---

## Migration Path

This contract is designed for gradual adoption:

1. ✅ **Phase 1** (Complete): Chat HITL integration, Ops Dashboard shows chat workload
2. ⏳ **Phase 2**: Add CSF mapper when CSF verification queue exists
3. ⏳ **Phase 3**: Add License mapper when license verification queue exists
4. ⏳ **Phase 4**: Build unified backend API to serve all events in contract format
5. ⏳ **Phase 5**: Replace legacy workload tracking with contract-based tracking

---

## Files

- **Contract**: `frontend/src/contracts/verificationWorkEvent.ts`
- **Documentation**: `frontend/src/contracts/README.md`
- **Consumer**: `frontend/src/pages/AdminOpsDashboard.tsx` (Ops Dashboard)
- **Execution**: `frontend/src/components/ReviewQueueList.tsx` (Chat Review Queue)

---

## Questions?

For implementation questions or to propose enhancements, see the AutoComply AI architecture documentation or consult the team.
