"""
Intelligence Repository - SQLite operations for Signal Intelligence (Phase 7.1 + 7.2).

Functions:
- upsert_signals: Insert or update signals for a case
- compute_and_upsert_decision_intelligence: Compute intelligence metrics and store (v2 with gaps/bias)
- get_decision_intelligence: Retrieve intelligence for a case
- get_signals: Retrieve signals for a case
"""

import uuid
import json
from datetime import datetime
from typing import List, Optional, Dict, Any

from src.core.db import execute_sql, execute_insert, execute_update, execute_update

from .models import Signal, DecisionIntelligence
from .expectations import get_expected_signals, get_required_signals
from .bias import detect_all_bias_flags
from .scoring import compute_confidence_v2
# Phase 7.8: Use new structured rules engine
from .rules_engine import evaluate_case, compute_confidence
# Phase 7.14: Field-level validation
from .field_validators import (
    validate_submission_fields,
    calculate_field_validation_impact,
    get_field_validation_stats,
    FieldIssue
)
from app.submissions.repo import get_submission
from app.workflow.repo import get_case


# ============================================================================
# Signal Operations
# ============================================================================

def upsert_signals(case_id: str, signals: List[Dict[str, Any]]) -> List[str]:
    """
    Insert or update signals for a case.
    
    Args:
        case_id: The case ID
        signals: List of signal dictionaries with fields:
            - decision_type: str
            - source_type: str (submission, evidence, rag_trace, case_event)
            - signal_strength: float (default 1.0)
            - completeness_flag: int (0 or 1, default 0)
            - metadata_json: str (JSON string, default "{}")
            - timestamp: str (optional, defaults to now)
            
    Returns:
        List of signal IDs created/updated
        
    Example:
        >>> upsert_signals("case_123", [
        ...     {
        ...         "decision_type": "csf_practitioner",
        ...         "source_type": "submission",
        ...         "completeness_flag": 1,
        ...         "metadata_json": '{"field": "license_number"}'
        ...     }
        ... ])
        ["sig_abc123"]
    """
    signal_ids = []
    now = datetime.utcnow().isoformat() + "Z"
    
    for signal_data in signals:
        signal_id = f"sig_{uuid.uuid4().hex[:12]}"
        timestamp = signal_data.get("timestamp", now)
        
        execute_insert(
            """
            INSERT INTO signals (
                id, case_id, decision_type, source_type, timestamp,
                signal_strength, completeness_flag, metadata_json, created_at
            ) VALUES (
                :id, :case_id, :decision_type, :source_type, :timestamp,
                :signal_strength, :completeness_flag, :metadata_json, :created_at
            )
            """,
            {
                "id": signal_id,
                "case_id": case_id,
                "decision_type": signal_data["decision_type"],
                "source_type": signal_data["source_type"],
                "timestamp": timestamp,
                "signal_strength": signal_data.get("signal_strength", 1.0),
                "completeness_flag": signal_data.get("completeness_flag", 0),
                "metadata_json": signal_data.get("metadata_json", "{}"),
                "created_at": now,
            },
        )
        signal_ids.append(signal_id)
    
    return signal_ids


def get_signals(
    case_id: str,
    source_type: Optional[str] = None,
    limit: int = 100
) -> List[Signal]:
    """
    Retrieve signals for a case.
    
    Args:
        case_id: The case ID
        source_type: Optional filter by source type
        limit: Maximum number of signals to return (default 100)
        
    Returns:
        List of Signal objects, ordered by timestamp descending
    """
    if source_type:
        rows = execute_sql(
            """
            SELECT id, case_id, decision_type, source_type, timestamp,
                   signal_strength, completeness_flag, metadata_json, created_at
            FROM signals
            WHERE case_id = :case_id AND source_type = :source_type
            ORDER BY timestamp DESC
            LIMIT :limit
            """,
            {
                "case_id": case_id,
                "source_type": source_type,
                "limit": limit,
            },
        )
    else:
        rows = execute_sql(
            """
            SELECT id, case_id, decision_type, source_type, timestamp,
                   signal_strength, completeness_flag, metadata_json, created_at
            FROM signals
            WHERE case_id = :case_id
            ORDER BY timestamp DESC
            LIMIT :limit
            """,
            {
                "case_id": case_id,
                "limit": limit,
            },
        )
    
    return [
        Signal(
            id=row["id"],
            case_id=row["case_id"],
            decision_type=row["decision_type"],
            source_type=row["source_type"],
            timestamp=row["timestamp"],
            signal_strength=row["signal_strength"],
            completeness_flag=row["completeness_flag"],
            metadata_json=row["metadata_json"],
            created_at=row["created_at"],
        )
        for row in rows
    ]


# ============================================================================
# Decision Intelligence Operations
# ============================================================================

def compute_and_upsert_decision_intelligence(case_id: str, decision_type: str = "default") -> DecisionIntelligence:
    """
    Compute decision intelligence v2 for a case and store it (PHASE 7.2).
    
    This function:
    1. Retrieves all signals for the case
    2. Detects gaps (missing, partial, weak, stale)
    3. Detects bias (single-source, low diversity, contradictions, stale)
    4. Computes confidence v2 (weighted, penalized, explainable)
    5. Generates a narrative template
    6. Upserts the intelligence record
    
    Args:
        case_id: The case ID
        decision_type: Decision type for gap expectations (e.g., "csf", "license_renewal")
        
    Returns:
        DecisionIntelligence object with computed metrics (v2)
        
    Algorithm (v2):
        - Gap Detection: Compare expected signals vs actual signals
          - Missing: Required signal not present
          - Partial: Signal has completeness_flag=0
          - Weak: Signal strength below threshold
          - Stale: Signal older than max_age_hours
        - Bias Detection: Heuristics for signal quality
          - Single-source reliance: >70% strength from one source
          - Low diversity: <3 unique source types
          - Contradictions: Conflicting signal patterns
          - Stale signals: >72 hours old
        - Confidence v2: Weighted scoring with penalties
          - Base: Sum of (signal_weight × strength × completeness)
          - Penalties: Gaps and bias flags reduce confidence
          - Explanation factors: Transparent scoring breakdown
        - Completeness: % of signals with completeness_flag=1
        - Gap Severity Score: 0-100 based on gap count/severity
    """
    # Retrieve all signals
    signal_objs = get_signals(case_id, limit=1000)
    
    # Convert to dicts for analysis
    signal_dicts = []
    for s in signal_objs:
        signal_dicts.append({
            "id": s.id,
            "case_id": s.case_id,
            "decision_type": s.decision_type,
            "source_type": s.source_type,
            "timestamp": s.timestamp,
            "signal_strength": s.signal_strength,
            "completeness_flag": s.completeness_flag,
            "metadata_json": s.metadata_json,
            "created_at": s.created_at,
        })
    
    # ========================================================================
    # Gap Detection
    # ========================================================================
    gaps = []
    gap_severity_score = 0
    
    if len(signal_dicts) == 0:
        # No signals yet - all expected signals are missing
        expected_signals = get_expected_signals(decision_type)
        for exp in expected_signals:
            severity = "high" if exp.required else "medium"
            gaps.append({
                "gapType": "missing",
                "severity": severity,
                "signalType": exp.signal_type,
                "message": f"Required signal '{exp.signal_type}' is missing",
                "expectedThreshold": exp.min_strength,
            })
        gap_severity_score = 100  # Maximum gap severity
    else:
        # Analyze gaps
        expected_signals = get_expected_signals(decision_type)
        
        # Build index of actual signals by type
        signals_by_type: Dict[str, List[Dict[str, Any]]] = {}
        for signal in signal_dicts:
            try:
                metadata = json.loads(signal.get("metadata_json", "{}"))
                signal_type = metadata.get("signal_type", "unknown")
            except:
                signal_type = "unknown"
            
            if signal_type not in signals_by_type:
                signals_by_type[signal_type] = []
            signals_by_type[signal_type].append(signal)
        
        # Check for gaps
        missing_count = 0
        partial_count = 0
        weak_count = 0
        stale_count = 0
        
        for exp in expected_signals:
            if exp.signal_type not in signals_by_type:
                # Missing signal
                severity = "high" if exp.required else "medium"
                gaps.append({
                    "gapType": "missing",
                    "severity": severity,
                    "signalType": exp.signal_type,
                    "message": f"Required signal '{exp.signal_type}' is missing",
                    "expectedThreshold": exp.min_strength,
                })
                missing_count += 1
            else:
                # Signal exists - check partial, weak, stale
                for signal in signals_by_type[exp.signal_type]:
                    # Partial
                    if signal.get("completeness_flag", 0) == 0:
                        gaps.append({
                            "gapType": "partial",
                            "severity": "medium" if exp.required else "low",
                            "signalType": exp.signal_type,
                            "message": f"Signal '{exp.signal_type}' is incomplete",
                            "expectedThreshold": 1,
                        })
                        partial_count += 1
                    
                    # Weak
                    if signal.get("signal_strength", 0.0) < exp.min_strength:
                        gaps.append({
                            "gapType": "weak",
                            "severity": "medium" if exp.required else "low",
                            "signalType": exp.signal_type,
                            "message": f"Signal '{exp.signal_type}' strength {signal.get('signal_strength', 0.0):.2f} below threshold {exp.min_strength}",
                            "expectedThreshold": exp.min_strength,
                            "actualStrength": signal.get("signal_strength", 0.0),
                        })
                        weak_count += 1
                    
                    # Stale
                    if exp.max_age_hours:
                        try:
                            signal_time = datetime.fromisoformat(signal.get("timestamp", "").replace("Z", "+00:00"))
                            age_hours = (datetime.utcnow() - signal_time.replace(tzinfo=None)).total_seconds() / 3600
                            if age_hours > exp.max_age_hours:
                                gaps.append({
                                    "gapType": "stale",
                                    "severity": "low",
                                    "signalType": exp.signal_type,
                                    "message": f"Signal '{exp.signal_type}' is {int(age_hours)} hours old (max {exp.max_age_hours}h)",
                                    "ageHours": int(age_hours),
                                    "maxAgeHours": exp.max_age_hours,
                                })
                                stale_count += 1
                        except:
                            pass
        
        # Calculate gap severity score
        # Formula: 100 - (100 / (1 + 0.3*missing + 0.2*partial + 0.1*weak + 0.05*stale))
        gap_weight = (
            missing_count * 0.3 +
            partial_count * 0.2 +
            weak_count * 0.1 +
            stale_count * 0.05
        )
        if gap_weight > 0:
            gap_severity_score = min(100, int(100 * gap_weight / (1 + gap_weight)))
        else:
            gap_severity_score = 0
    
    # ========================================================================
    # Bias Detection
    # ========================================================================
    bias_flags = detect_all_bias_flags(signal_dicts)
    
    # ========================================================================
    # Confidence v3: Rule-Based Validation (Phase 7.8)
    # ========================================================================
    # Fetch the case to get submission_id
    case = get_case(case_id)
    submission_data = {}
    if case and case.submissionId:
        submission = get_submission(case.submissionId)
        if submission and hasattr(submission, 'formData'):
            submission_data = submission.formData or {}
    
    # Evaluate validation rules using new rules engine
    rule_results = evaluate_case(decision_type, submission_data)
    confidence_score, confidence_band, rule_summary = compute_confidence(rule_results)
    
    # Extract failed rules for API response
    failed_rules_list = rule_summary.get("failed_rules", [])
    
    # ========================================================================
    # Phase 7.14: Field-Level Validation
    # ========================================================================
    field_issues = []
    field_checks_total = 0
    field_checks_passed = 0
    confidence_rationale = ""
    
    if submission_data:
        # Run field validators
        field_issues = validate_submission_fields(submission_data, decision_type)
        
        # Get stats
        field_stats = get_field_validation_stats(field_issues, decision_type)
        field_checks_total = field_stats['field_checks_total']
        field_checks_passed = field_stats['field_checks_passed']
        
        # Apply field validation penalties to confidence
        base_confidence = confidence_score
        confidence_score, confidence_rationale = calculate_field_validation_impact(
            base_confidence, field_issues
        )
        
        # Re-compute confidence_band from adjusted score
        if confidence_score >= 80:
            confidence_band = "high"
        elif confidence_score >= 50:
            confidence_band = "medium"
        else:
            confidence_band = "low"
    
    # For backward compatibility, create explanation_factors from rules
    passed_count = rule_summary.get("rules_passed", 0)
    failed_count = rule_summary.get("rules_failed_count", 0)
    total_count = rule_summary.get("rules_total", 0)
    
    explanation_factors = {
        "method": "rule_based_validation",
        "total_rules": total_count,
        "passed_rules": passed_count,
        "failed_rules": failed_count,
        "rule_summary": rule_summary,
        "critical_failures": [r["rule_id"] for r in failed_rules_list if r["severity"] == "critical"],
        "medium_failures": [r["rule_id"] for r in failed_rules_list if r["severity"] == "medium"],
        "decision_type": decision_type,
        # Phase 7.14: Field validation data
        "field_checks_total": field_checks_total,
        "field_checks_passed": field_checks_passed,
        "field_issues": [
            {
                "field": issue.field,
                "severity": issue.severity,
                "check": issue.check,
                "message": issue.message
            }
            for issue in field_issues
        ],
        "confidence_rationale": confidence_rationale,
    }
    
    # ========================================================================
    # Completeness (legacy metric)
    # ========================================================================
    if len(signal_dicts) == 0:
        completeness_score = 0
    else:
        complete_signals = [s for s in signal_dicts if s.get("completeness_flag", 0) == 1]
        completeness_score = int((len(complete_signals) / len(signal_dicts)) * 100)
    
    # ========================================================================
    # Narrative
    # ========================================================================
    gap_count = len(gaps)
    bias_count = len(bias_flags)
    field_issues_count = len(field_issues)
    
    narrative_parts = [
        f"Case passed {passed_count}/{total_count} validation rules"
    ]
    
    if field_checks_total > 0:
        narrative_parts.append(f"and {field_checks_passed}/{field_checks_total} field checks")
    
    issue_parts = []
    if gap_count > 0:
        issue_parts.append(f"{gap_count} gap(s)")
    if bias_count > 0:
        issue_parts.append(f"{bias_count} bias flag(s)")
    if field_issues_count > 0:
        issue_parts.append(f"{field_issues_count} field issue(s)")
    
    if issue_parts:
        narrative_parts.append(f"with {', '.join(issue_parts)}")
    
    narrative_parts.append(f"Confidence: {confidence_band} ({confidence_score}%).")
    
    if confidence_rationale:
        narrative_parts.append(confidence_rationale)
    
    narrative = " ".join(narrative_parts)
    
    # ========================================================================
    # Prepare data
    # ========================================================================
    now = datetime.utcnow().isoformat() + "Z"
    gap_json = json.dumps(gaps)
    bias_json = json.dumps(bias_flags)
    explanation_json = json.dumps(explanation_factors)
    
    # ========================================================================
    # Upsert decision intelligence
    # ========================================================================
    existing = get_decision_intelligence(case_id)
    
    if existing:
        execute_update(
            """
            UPDATE decision_intelligence
            SET computed_at = :computed_at,
                updated_at = :updated_at,
                completeness_score = :completeness_score,
                gap_json = :gap_json,
                bias_json = :bias_json,
                confidence_score = :confidence_score,
                confidence_band = :confidence_band,
                narrative_template = :narrative_template,
                narrative_genai = :narrative_genai,
                executive_summary_json = :executive_summary_json
            WHERE case_id = :case_id
            """,
            {
                "case_id": case_id,
                "computed_at": now,
                "updated_at": now,
                "completeness_score": completeness_score,
                "gap_json": gap_json,
                "bias_json": bias_json,
                "confidence_score": confidence_score,
                "confidence_band": confidence_band,
                "narrative_template": narrative,
                "narrative_genai": None,
                "executive_summary_json": explanation_json,  # Store rule summary
            },
        )
    else:
        execute_insert(
            """
            INSERT INTO decision_intelligence (
                case_id, computed_at, updated_at, completeness_score, gap_json,
                bias_json, confidence_score, confidence_band, narrative_template, narrative_genai,
                executive_summary_json
            ) VALUES (
                :case_id, :computed_at, :updated_at, :completeness_score, :gap_json,
                :bias_json, :confidence_score, :confidence_band, :narrative_template, :narrative_genai,
                :executive_summary_json
            )
            """,
            {
                "case_id": case_id,
                "computed_at": now,
                "updated_at": now,
                "completeness_score": completeness_score,
                "gap_json": gap_json,
                "bias_json": bias_json,
                "confidence_score": confidence_score,
                "confidence_band": confidence_band,
                "narrative_template": narrative,
                "narrative_genai": None,
                "executive_summary_json": explanation_json,  # Store rule summary
            },
        )
    
    return DecisionIntelligence(
        case_id=case_id,
        computed_at=now,
        updated_at=now,
        completeness_score=completeness_score,
        gap_json=gap_json,
        bias_json=bias_json,
        confidence_score=confidence_score,  # Phase 7.2: Keep as float
        confidence_band=confidence_band,
        narrative_template=narrative,
        narrative_genai=None,
    )


def get_decision_intelligence(case_id: str) -> Optional[DecisionIntelligence]:
    """
    Retrieve decision intelligence for a case.
    
    Args:
        case_id: The case ID
        
    Returns:
        DecisionIntelligence object if exists, None otherwise
    """
    rows = execute_sql(
        """
        SELECT case_id, computed_at, updated_at, completeness_score, gap_json,
               bias_json, confidence_score, confidence_band, narrative_template, narrative_genai,
               executive_summary_json
        FROM decision_intelligence
        WHERE case_id = :case_id
        """,
        {"case_id": case_id},
    )
    
    if not rows:
        return None
    
    row = rows[0]
    return DecisionIntelligence(
        case_id=row["case_id"],
        computed_at=row["computed_at"],
        updated_at=row["updated_at"],
        completeness_score=row["completeness_score"],
        gap_json=row["gap_json"],
        bias_json=row["bias_json"],
        confidence_score=float(row["confidence_score"]),  # Ensure float type
        confidence_band=row["confidence_band"],
        narrative_template=row["narrative_template"],
        narrative_genai=row.get("narrative_genai"),
        executive_summary_json=row.get("executive_summary_json"),  # Phase 7.6
    )


def update_executive_summary(case_id: str, executive_summary_json: str) -> None:
    """
    Update just the executive_summary_json field for a case (Phase 7.6).
    
    Args:
        case_id: The case ID
        executive_summary_json: JSON string of ExecutiveSummary
    """
    from src.core.db import execute_update
    
    execute_update(
        """
        UPDATE decision_intelligence
        SET executive_summary_json = :executive_summary_json,
            updated_at = :updated_at
        WHERE case_id = :case_id
        """,
        {
            "case_id": case_id,
            "executive_summary_json": executive_summary_json,
            "updated_at": datetime.utcnow().isoformat() + "Z",
        },
    )


# ============================================================================
# Intelligence History Operations (Phase 7.11 + 7.20)
# ============================================================================

def insert_intelligence_history(
    case_id: str,
    payload: Dict[str, Any],
    actor: str = "system",
    reason: str = "Intelligence updated",
    triggered_by: Optional[str] = None,
    input_hash: Optional[str] = None,
    previous_run_id: Optional[str] = None
) -> str:
    """
    Insert a snapshot of intelligence into history table (append-only).
    
    Phase 7.20: Enhanced with integrity fields for audit trail hardening:
    - previous_run_id: Links to previous computation for audit chain
    - triggered_by: Role/user who triggered recompute  
    - input_hash: Stable hash of normalized inputs
    
    Phase 7.24: Enhanced with evidence snapshot for reproducibility:
    - evidence_snapshot: JSON snapshot of evidence used for computation
    - evidence_hash: SHA256 hash of normalized evidence
    - evidence_version: Schema version for evidence snapshot
    
    Phase 7.25: Enhanced with policy versioning for traceability:
    - policy_id: Identifier for the policy set used
    - policy_version: Semantic version of the policy
    - policy_hash: SHA256 hash of the policy definition
    
    Args:
        case_id: The case ID
        payload: Full DecisionIntelligenceResponse dict
        actor: Who triggered the recompute (email/system)
        reason: Why the recompute happened
        triggered_by: Role/user identifier (e.g., "admin", "verifier", "system")
        input_hash: SHA256 hash of normalized inputs
        previous_run_id: ID of previous history entry (for audit chain)
        
    Returns:
        History entry ID
        
    Example:
        >>> insert_intelligence_history(
        ...     case_id="case_123",
        ...     payload={"confidence_score": 85, ...},
        ...     actor="verifier@example.com",
        ...     reason="Evidence attached",
        ...     triggered_by="verifier",
        ...     input_hash="a1b2c3d4...",
        ...     previous_run_id="hist_abc"
        ... )
        "hist_xyz123"
        
    Note:
        This function enforces append-only behavior - it only creates new records,
        never updates existing ones. This ensures audit trail integrity.
    """
    history_id = f"hist_{uuid.uuid4().hex[:12]}"
    now = datetime.utcnow().isoformat() + "Z"
    computed_at = payload.get("computed_at", now)
    
    # Phase 7.24: Create evidence snapshot
    from .evidence_snapshot import (
        create_evidence_snapshot,
        compute_evidence_hash,
        get_evidence_version
    )
    
    evidence_snapshot = create_evidence_snapshot(case_id)
    evidence_hash = compute_evidence_hash(evidence_snapshot)
    evidence_version = get_evidence_version()
    
    # Phase 7.25: Capture current policy version
    from app.policy import get_current_policy
    
    current_policy = get_current_policy()
    policy_id = current_policy.policy_id
    policy_version = current_policy.version
    policy_hash = current_policy.policy_hash
    
    # Phase 7.20: If previous_run_id not provided, try to get the latest entry
    if previous_run_id is None:
        latest = execute_sql(
            """
            SELECT id FROM intelligence_history
            WHERE case_id = :case_id
            ORDER BY computed_at DESC
            LIMIT 1
            """,
            {"case_id": case_id}
        )
        if latest:
            previous_run_id = latest[0]["id"]
    
    execute_insert(
        """
        INSERT INTO intelligence_history (
            id, case_id, computed_at, payload_json,
            created_at, actor, reason,
            previous_run_id, triggered_by, input_hash,
            evidence_snapshot, evidence_hash, evidence_version,
            policy_id, policy_version, policy_hash
        ) VALUES (
            :id, :case_id, :computed_at, :payload_json,
            :created_at, :actor, :reason,
            :previous_run_id, :triggered_by, :input_hash,
            :evidence_snapshot, :evidence_hash, :evidence_version,
            :policy_id, :policy_version, :policy_hash
        )
        """,
        {
            "id": history_id,
            "case_id": case_id,
            "computed_at": computed_at,
            "payload_json": json.dumps(payload),
            "created_at": now,
            "actor": actor,
            "reason": reason,
            "previous_run_id": previous_run_id,
            "triggered_by": triggered_by or actor,  # Default to actor if not provided
            "input_hash": input_hash,
            "evidence_snapshot": json.dumps(evidence_snapshot),
            "evidence_hash": evidence_hash,
            "evidence_version": evidence_version,
            "policy_id": policy_id,
            "policy_version": policy_version,
            "policy_hash": policy_hash,
        },
    )
    
    return history_id


def get_intelligence_history(
    case_id: str,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """
    Retrieve intelligence history for a case, ordered newest first.
    
    Phase 7.20: Now includes integrity fields (previous_run_id, triggered_by, input_hash).
    Phase 7.24: Now includes evidence fields (evidence_snapshot, evidence_hash, evidence_version).
    Phase 7.25: Now includes policy fields (policy_id, policy_version, policy_hash).
    
    Args:
        case_id: The case ID
        limit: Maximum number of history entries to return
        
    Returns:
        List of history entries with fields:
        - id: History entry ID
        - case_id: Case ID
        - computed_at: When intelligence was computed
        - payload: Full intelligence response
        - created_at: When history entry was created
        - actor: Who triggered the recompute
        - reason: Why the recompute happened
        - previous_run_id: ID of previous history entry (audit chain)
        - triggered_by: Role/user who triggered recompute
        - input_hash: Stable hash of inputs
        - evidence_snapshot: JSON snapshot of evidence
        - evidence_hash: SHA256 hash of evidence
        - evidence_version: Schema version for evidence
        - policy_id: Policy set identifier
        - policy_version: Semantic version of policy
        - policy_hash: SHA256 hash of policy definition
        
    Example:
        >>> get_intelligence_history("case_123", limit=5)
        [
            {
                "id": "hist_xyz",
                "computed_at": "2026-01-17T22:30:00Z",
                "payload": {"confidence_score": 85, ...},
                "previous_run_id": "hist_abc",
                "triggered_by": "verifier",
                "input_hash": "a1b2c3...",
                "evidence_hash": "def456...",
                "policy_version": "1.0.0",
                "policy_hash": "abc123...",
                ...
            }
        ]
    """
    rows = execute_sql(
        """
        SELECT 
            id, case_id, computed_at, payload_json,
            created_at, actor, reason,
            previous_run_id, triggered_by, input_hash,
            evidence_snapshot, evidence_hash, evidence_version,
            policy_id, policy_version, policy_hash
        FROM intelligence_history
        WHERE case_id = :case_id
        ORDER BY computed_at DESC
        LIMIT :limit
        """,
        {"case_id": case_id, "limit": limit},
    )
    
    return [
        {
            "id": row["id"],
            "case_id": row["case_id"],
            "computed_at": row["computed_at"],
            "payload": json.loads(row["payload_json"]),
            "created_at": row["created_at"],
            "actor": row["actor"],
            "reason": row["reason"],
            "previous_run_id": row.get("previous_run_id"),  # Phase 7.20
            "triggered_by": row.get("triggered_by"),        # Phase 7.20
            "input_hash": row.get("input_hash"),            # Phase 7.20
            "evidence_snapshot": json.loads(row["evidence_snapshot"]) if row.get("evidence_snapshot") else None,  # Phase 7.24
            "evidence_hash": row.get("evidence_hash"),      # Phase 7.24
            "evidence_version": row.get("evidence_version"), # Phase 7.24
            "policy_id": row.get("policy_id"),              # Phase 7.25
            "policy_version": row.get("policy_version"),    # Phase 7.25
            "policy_hash": row.get("policy_hash"),          # Phase 7.25
        }
        for row in rows
    ]


def cleanup_old_intelligence_history(case_id: str, keep_last_n: int = 50) -> int:
    """
    Remove old history entries, keeping only the most recent N.
    
    Args:
        case_id: The case ID
        keep_last_n: Number of most recent entries to keep
        
    Returns:
        Number of rows deleted
        
    Example:
        >>> cleanup_old_intelligence_history("case_123", keep_last_n=50)
        12  # Deleted 12 old entries
    """
    # Get IDs of entries to keep (most recent N)
    keep_ids_rows = execute_sql(
        """
        SELECT id
        FROM intelligence_history
        WHERE case_id = :case_id
        ORDER BY computed_at DESC
        LIMIT :keep_last_n
        """,
        {"case_id": case_id, "keep_last_n": keep_last_n},
    )
    
    if not keep_ids_rows:
        return 0
    
    keep_id_list = [row["id"] for row in keep_ids_rows]
    
    # Build named parameters for the NOT IN clause
    placeholders = ",".join([f":id{i}" for i in range(len(keep_id_list))])
    params = {"case_id": case_id}
    for i, hist_id in enumerate(keep_id_list):
        params[f"id{i}"] = hist_id
    
    # Delete entries not in the keep list
    deleted = execute_update(
        f"""
        DELETE FROM intelligence_history
        WHERE case_id = :case_id
        AND id NOT IN ({placeholders})
        """,
        params,
    )
    
    return deleted
