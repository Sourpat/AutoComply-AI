# CSF Practitioner Knowledge Model Specification

## Overview

This document defines the minimum enterprise-grade knowledge model for the **DEA Practitioner CSF approval/explainability** decision flow.

## Decision Type Taxonomy

- **Engine Family**: `csf`
- **Decision Type**: `csf_practitioner`
- **Scope**: DEA-registered practitioners applying for Controlled Substance Form (CSF) approval

## Evidence Schema

### Rule Object

Each rule in the knowledge base follows this structure:

```python
{
  "id": str,                    # Unique identifier (e.g., "csf_pract_dea_001")
  "title": str,                 # Human-readable rule title
  "jurisdiction": str,          # Jurisdiction code (e.g., "US-FEDERAL", "US-OH")
  "applies_to": str,            # Entity type (e.g., "practitioner", "hospital")
  "requirement": str,           # The compliance requirement or rule text
  "rationale": str,             # Why this rule exists / regulatory intent
  "citation_label": str,        # Short citation reference (e.g., "21 CFR 1301.13")
  "citation_text": str,         # Full legal citation text
  "tags": List[str],            # Searchable tags (e.g., ["dea", "registration", "expiry"])
  "severity": str,              # "block" | "review" | "info"
  "effective_date": Optional[str],  # ISO date when rule became effective
  "source_url": Optional[str]   # Link to authoritative source
}
```

### Evidence Chunk Object

When rules are returned as RAG evidence, they are transformed into `RegulatorySource` objects:

```python
{
  "id": str,                    # Maps to rule.id
  "label": str,                 # Maps to rule.title
  "jurisdiction": str,          # Maps to rule.jurisdiction
  "citation": str,              # Maps to rule.citation_label
  "snippet": str,               # Combines requirement + rationale
  "score": float,               # Relevance score (0.0-1.0)
  "raw_score": float,           # Raw search score before normalization
  "source_type": str            # "rule" | "guidance" | "form"
}
```

## Explanation Output Schema

When `/rag/regulatory-explain` is called with `decision_type="csf_practitioner"`, the response includes:

```python
{
  "answer": str,                        # Natural language explanation
  "sources": List[RegulatorySource],    # Evidence chunks supporting the decision
  "regulatory_references": List[str],   # List of rule IDs cited
  "artifacts_used": List[str],          # Document IDs used in analysis
  "debug": {
    "decision_type": "csf_practitioner",
    "engine_family": "csf",
    "rules_evaluated": int,
    "blocking_rules": List[str],
    "review_rules": List[str],
    "info_rules": List[str]
  }
}
```

## Severity Levels

- **block**: Hard compliance requirement - immediate rejection if violated
- **review**: Requires human review or additional documentation
- **info**: Informational / best practice - advisory only

## Required Fields for CSF Practitioner

Evidence must cover these decision dimensions:

1. **DEA Registration**: Valid, current DEA number with appropriate schedules
2. **State License**: Active state medical/pharmacy license
3. **Controlled Substance Schedules**: Authorized schedule levels (II-V)
4. **Practice Type**: Standard practitioner vs specialized (hospital, EMS, researcher)
5. **Expiry Dates**: No expired credentials
6. **Attestations**: Required compliance acknowledgments
7. **Geographic Restrictions**: Ship-to state restrictions
8. **Documentation**: Supporting documents (license copies, DEA certificate)

## Integration Points

### Endpoints

- **Preview**: `POST /rag/regulatory/preview` with `decision_type="csf_practitioner"`
- **Search**: `POST /rag/regulatory/search` with queries like "DEA practitioner CSF requirements"
- **Explain**: `POST /rag/regulatory-explain` with `decision_type="csf_practitioner"`

### Knowledge Base Access

Rules are loaded via `RegulatoryKnowledge` singleton in `src/autocomply/regulations/knowledge.py`.

### Frontend Integration

RAG Explorer UI (`RegulatoryKnowledgeExplorerPanel.tsx`) enables compliance analysts to:
- Search rules by natural language query
- Preview rules for a specific decision type
- Understand decision rationale with linked evidence

## Example Rule

```json
{
  "id": "csf_pract_dea_001",
  "title": "Valid DEA registration required for practitioner CSF",
  "jurisdiction": "US-FEDERAL",
  "applies_to": "practitioner",
  "requirement": "Practitioner must possess a current, non-expired DEA registration certificate. DEA number must be verifiable against the DEA registration database.",
  "rationale": "21 CFR 1301.13 requires all practitioners handling controlled substances to maintain valid DEA registration. Expired or suspended registrations disqualify CSF approval.",
  "citation_label": "21 CFR 1301.13",
  "citation_text": "21 CFR § 1301.13 - Application for registration; time for filing; expiration date; registration for independent activities; exemptions",
  "tags": ["dea", "registration", "expiry", "federal"],
  "severity": "block",
  "effective_date": "1971-05-01",
  "source_url": "https://www.ecfr.gov/current/title-21/chapter-II/part-1301/section-1301.13"
}
```

## Design Principles

1. **Deterministic**: No external API calls; all logic is rule-based
2. **Traceable**: Every decision links back to specific rule IDs
3. **Explainable**: Natural language rationale for each rule
4. **Extensible**: New rules can be added without code changes
5. **Testable**: Seed data enables end-to-end testing without real credentials
