"""
Playbook Adherence Scoring

Calculates adherence to standard playbooks based on audit events.
Maps playbook steps to audit signals and provides completion metrics.
"""

from typing import List, Dict, Any, Optional
from src.core.db import execute_sql

# ============================================================================
# Playbook Definitions
# ============================================================================

# CSF Practitioner Playbook (matches frontend schema)
CSF_PRACTITIONER_PLAYBOOK = {
    "steps": [
        {
            "id": "review_submission",
            "title": "Review Submission",
            "description": "Review the practitioner's CSF application",
            "signals": ["submission_received", "case_opened"],
        },
        {
            "id": "verify_identity",
            "title": "Verify Identity",
            "description": "Verify practitioner identity documents",
            "signals": ["evidence_attached", "packet_updated"],
        },
        {
            "id": "check_credentials",
            "title": "Check Credentials",
            "description": "Verify medical credentials and licenses",
            "signals": ["evidence_attached", "packet_updated"],
        },
        {
            "id": "review_evidence",
            "title": "Review Evidence",
            "description": "Review all supporting evidence and documents",
            "signals": ["evidence_attached", "packet_updated", "evidence_reviewed"],
        },
        {
            "id": "request_info_if_needed",
            "title": "Request Info (if needed)",
            "description": "Request additional information if gaps exist",
            "signals": ["requested_info", "status_changed"],
        },
        {
            "id": "make_determination",
            "title": "Make Determination",
            "description": "Make final approval/denial decision",
            "signals": ["status_changed", "decision_made"],
        },
        {
            "id": "add_note",
            "title": "Add Review Notes",
            "description": "Document review findings and rationale",
            "signals": ["note_added", "comment_added"],
        },
        {
            "id": "set_status",
            "title": "Update Case Status",
            "description": "Set appropriate case status",
            "signals": ["status_changed", "case_updated"],
        },
    ]
}

# Ohio TDDD Playbook
OHIO_TDDD_PLAYBOOK = {
    "steps": [
        {
            "id": "review_submission",
            "title": "Review Application Submission",
            "description": "Confirm application type and verify all required forms",
            "signals": ["submission_received", "case_opened"],
        },
        {
            "id": "validate_tddd_license",
            "title": "Validate TDDD License Status",
            "description": "Verify Ohio TDDD license is active and valid",
            "signals": ["evidence_attached", "license_verified", "packet_updated"],
        },
        {
            "id": "verify_category_authorization",
            "title": "Verify Category Authorization",
            "description": "Confirm TDDD category matches requested substances",
            "signals": ["evidence_attached", "category_verified"],
        },
        {
            "id": "validate_responsible_pharmacist",
            "title": "Validate Responsible Pharmacist",
            "description": "Verify designated responsible pharmacist credentials",
            "signals": ["evidence_attached", "pharmacist_verified"],
        },
        {
            "id": "inspect_storage_security",
            "title": "Inspect Storage Security Compliance",
            "description": "Review storage facility security measures",
            "signals": ["evidence_attached", "facility_inspected"],
        },
        {
            "id": "review_inspection_history",
            "title": "Review Inspection History",
            "description": "Check recent Ohio Board of Pharmacy inspections",
            "signals": ["inspection_reviewed", "history_checked"],
        },
        {
            "id": "verify_dispensing_protocol",
            "title": "Verify Dispensing Protocol",
            "description": "Confirm written dispensing protocols on file",
            "signals": ["protocol_verified", "documentation_reviewed"],
        },
        {
            "id": "validate_wholesale_records",
            "title": "Validate Wholesale Records",
            "description": "Verify wholesale distribution records if applicable",
            "signals": ["records_reviewed", "compliance_verified"],
        },
        {
            "id": "check_biennial_renewal",
            "title": "Check Biennial Renewal Status",
            "description": "Verify renewal status and expiration date",
            "signals": ["renewal_checked", "status_updated"],
        },
        {
            "id": "verify_oarrs_reporting",
            "title": "Verify OARRS Reporting",
            "description": "Confirm OARRS reporting compliance",
            "signals": ["oarrs_verified", "reporting_checked"],
        },
        {
            "id": "review_staff_training",
            "title": "Review Staff Training",
            "description": "Verify staff training documentation",
            "signals": ["training_verified", "documentation_reviewed"],
        },
        {
            "id": "final_disposition",
            "title": "Finalize Disposition",
            "description": "Make final decision and communicate outcome",
            "signals": ["status_changed", "decision_made", "note_added"],
        },
    ]
}

# NY Pharmacy License Playbook
NY_PHARMACY_LICENSE_PLAYBOOK = {
    "steps": [
        {
            "id": "review_submission",
            "title": "Review Application Submission",
            "description": "Confirm application type and verify all forms",
            "signals": ["submission_received", "case_opened"],
        },
        {
            "id": "validate_pharmacy_license",
            "title": "Validate NY Pharmacy License",
            "description": "Verify New York pharmacy license is active",
            "signals": ["evidence_attached", "license_verified", "packet_updated"],
        },
        {
            "id": "verify_pharmacist_in_charge",
            "title": "Verify Pharmacist-in-Charge",
            "description": "Confirm PIC has active NY pharmacist license",
            "signals": ["evidence_attached", "pic_verified"],
        },
        {
            "id": "validate_nysdoh_registration",
            "title": "Validate NYSDOH Registration",
            "description": "Verify NYSDOH registration is current",
            "signals": ["evidence_attached", "registration_verified"],
        },
        {
            "id": "verify_bne_registration",
            "title": "Verify BNE Registration",
            "description": "Confirm BNE controlled substance registration",
            "signals": ["evidence_attached", "bne_verified"],
        },
        {
            "id": "inspect_facility_standards",
            "title": "Inspect Facility Standards",
            "description": "Review facility inspection reports",
            "signals": ["evidence_attached", "facility_inspected"],
        },
        {
            "id": "verify_istop_compliance",
            "title": "Verify I-STOP Compliance",
            "description": "Confirm I-STOP PDMP compliance",
            "signals": ["istop_verified", "pdmp_checked"],
        },
        {
            "id": "check_staffing_ratios",
            "title": "Check Staffing Ratios",
            "description": "Verify pharmacist-technician ratios",
            "signals": ["staffing_verified", "compliance_checked"],
        },
        {
            "id": "validate_prescription_records",
            "title": "Validate Prescription Records",
            "description": "Verify prescription record retention",
            "signals": ["records_reviewed", "documentation_verified"],
        },
        {
            "id": "verify_compounding_registration",
            "title": "Verify Compounding Registration",
            "description": "Check compounding registration if applicable",
            "signals": ["compounding_verified", "registration_checked"],
        },
        {
            "id": "check_triennial_renewal",
            "title": "Check Triennial Renewal",
            "description": "Verify triennial renewal status",
            "signals": ["renewal_checked", "status_updated"],
        },
        {
            "id": "final_disposition",
            "title": "Finalize Disposition",
            "description": "Make final decision and communicate outcome",
            "signals": ["status_changed", "decision_made", "note_added"],
        },
    ]
}

# CSF Facility Playbook
CSF_FACILITY_PLAYBOOK = {
    "steps": [
        {
            "id": "review_submission",
            "title": "Review Facility Application",
            "description": "Confirm application type and verify institutional forms",
            "signals": ["submission_received", "case_opened"],
        },
        {
            "id": "validate_facility_dea",
            "title": "Validate Facility DEA Registration",
            "description": "Verify facility DEA registration is active",
            "signals": ["evidence_attached", "dea_verified", "packet_updated"],
        },
        {
            "id": "validate_state_license",
            "title": "Validate State Facility License",
            "description": "Confirm state healthcare facility license",
            "signals": ["evidence_attached", "license_verified"],
        },
        {
            "id": "verify_responsible_person",
            "title": "Verify Designated Responsible Person",
            "description": "Confirm responsible pharmacist or physician",
            "signals": ["evidence_attached", "responsible_verified"],
        },
        {
            "id": "inspect_storage_security",
            "title": "Inspect Storage Security",
            "description": "Review storage security measures",
            "signals": ["evidence_attached", "security_verified"],
        },
        {
            "id": "validate_recordkeeping",
            "title": "Validate Recordkeeping System",
            "description": "Verify controlled substance recordkeeping",
            "signals": ["records_reviewed", "system_verified"],
        },
        {
            "id": "check_biennial_inventory",
            "title": "Check Biennial Inventory",
            "description": "Verify biennial inventory compliance",
            "signals": ["inventory_verified", "compliance_checked"],
        },
        {
            "id": "review_diversion_program",
            "title": "Review Diversion Prevention Program",
            "description": "Confirm diversion prevention policies",
            "signals": ["diversion_verified", "policy_reviewed"],
        },
        {
            "id": "verify_staff_training",
            "title": "Verify Staff Training",
            "description": "Verify staff training documentation",
            "signals": ["training_verified", "documentation_reviewed"],
        },
        {
            "id": "validate_theft_procedures",
            "title": "Validate Theft/Loss Procedures",
            "description": "Confirm theft/loss reporting procedures",
            "signals": ["procedures_verified", "documentation_reviewed"],
        },
        {
            "id": "review_inspection_history",
            "title": "Review Inspection History",
            "description": "Check DEA and state inspection findings",
            "signals": ["inspection_reviewed", "history_checked"],
        },
        {
            "id": "check_dea_renewal",
            "title": "Check DEA Renewal Status",
            "description": "Verify DEA registration renewal",
            "signals": ["renewal_checked", "status_updated"],
        },
        {
            "id": "final_disposition",
            "title": "Finalize Disposition",
            "description": "Make final decision and communicate outcome",
            "signals": ["status_changed", "decision_made", "note_added"],
        },
    ]
}

# Generic playbook for other decision types
GENERIC_PLAYBOOK = {
    "steps": [
        {
            "id": "review_submission",
            "title": "Review Submission",
            "description": "Review the initial submission",
            "signals": ["submission_received", "case_opened"],
        },
        {
            "id": "review_evidence",
            "title": "Review Evidence",
            "description": "Review supporting evidence",
            "signals": ["evidence_attached", "packet_updated"],
        },
        {
            "id": "request_info_if_needed",
            "title": "Request Info (if needed)",
            "description": "Request additional information",
            "signals": ["requested_info"],
        },
        {
            "id": "add_note",
            "title": "Add Notes",
            "description": "Document review notes",
            "signals": ["note_added"],
        },
        {
            "id": "set_status",
            "title": "Update Status",
            "description": "Update case status",
            "signals": ["status_changed"],
        },
    ]
}

# Playbook registry
PLAYBOOKS = {
    "csf": CSF_PRACTITIONER_PLAYBOOK,  # Default CSF uses practitioner playbook
    "csf_practitioner": CSF_PRACTITIONER_PLAYBOOK,
    "ohio_tddd": OHIO_TDDD_PLAYBOOK,
    "ny_pharmacy_license": NY_PHARMACY_LICENSE_PLAYBOOK,
    "csf_facility": CSF_FACILITY_PLAYBOOK,
    # Legacy/other mappings
    "csf_hospital": CSF_FACILITY_PLAYBOOK,
    "csf_ems": GENERIC_PLAYBOOK,
    "csf_researcher": GENERIC_PLAYBOOK,
    "license_ohio_tddd": OHIO_TDDD_PLAYBOOK,
    "license_ny_pharmacy": NY_PHARMACY_LICENSE_PLAYBOOK,
}

# ============================================================================
# Adherence Calculation
# ============================================================================

def get_playbook_for_decision_type(decision_type: str) -> Optional[Dict[str, Any]]:
    """
    Get playbook definition for a decision type.
    
    Args:
        decision_type: Decision type identifier
        
    Returns:
        Playbook definition or None if not found
    """
    return PLAYBOOKS.get(decision_type)


def get_audit_events_for_case(case_id: str) -> List[Dict[str, Any]]:
    """
    Fetch all audit events for a case.
    
    Args:
        case_id: Case ID
        
    Returns:
        List of audit events
    """
    query = """
        SELECT id, event_type, actor_name, meta, created_at
        FROM audit_events
        WHERE case_id = :case_id
        ORDER BY created_at ASC
    """
    
    results = execute_sql(query, {"case_id": case_id})
    return [dict(row) for row in results]


def check_step_completion(step: Dict[str, Any], audit_events: List[Dict[str, Any]]) -> bool:
    """
    Check if a playbook step is completed based on audit signals.
    
    Args:
        step: Playbook step definition
        audit_events: List of audit events for the case
        
    Returns:
        True if step is completed
    """
    signals = step.get("signals", [])
    
    for event in audit_events:
        event_type = event.get("event_type", "")
        
        # Check if event type matches any of the step's signals
        for signal in signals:
            if signal.lower() in event_type.lower():
                return True
    
    return False


def calculate_adherence(case_id: str, decision_type: str) -> Dict[str, Any]:
    """
    Calculate playbook adherence for a case.
    
    Args:
        case_id: Case ID
        decision_type: Decision type
        
    Returns:
        Adherence metrics including percentage, completed/missing steps, recommendations
    """
    # Get playbook
    playbook = get_playbook_for_decision_type(decision_type)
    
    if not playbook:
        return {
            "decisionType": decision_type,
            "adherencePct": 0.0,
            "totalSteps": 0,
            "completedSteps": [],
            "missingSteps": [],
            "recommendedNextActions": [],
            "message": f"No playbook defined for decision type: {decision_type}",
        }
    
    # Get audit events
    audit_events = get_audit_events_for_case(case_id)
    
    # Check each step
    steps = playbook.get("steps", [])
    completed_steps = []
    missing_steps = []
    
    for step in steps:
        is_complete = check_step_completion(step, audit_events)
        
        step_info = {
            "id": step["id"],
            "title": step["title"],
            "description": step.get("description", ""),
        }
        
        if is_complete:
            completed_steps.append(step_info)
        else:
            missing_steps.append(step_info)
    
    # Calculate percentage
    total_steps = len(steps)
    completed_count = len(completed_steps)
    adherence_pct = (completed_count / total_steps * 100) if total_steps > 0 else 0.0
    
    # Generate recommendations (top 3 missing steps)
    recommended_next_actions = []
    for step in missing_steps[:3]:
        action = generate_recommendation(step, decision_type)
        recommended_next_actions.append(action)
    
    return {
        "decisionType": decision_type,
        "adherencePct": round(adherence_pct, 1),
        "totalSteps": total_steps,
        "completedSteps": completed_steps,
        "missingSteps": missing_steps,
        "recommendedNextActions": recommended_next_actions,
    }


def generate_recommendation(step: Dict[str, Any], decision_type: str) -> Dict[str, Any]:
    """
    Generate recommended action for a missing step.
    
    Args:
        step: Missing step info
        decision_type: Decision type
        
    Returns:
        Recommendation with step info and suggested action
    """
    step_id = step["id"]
    
    # Action suggestions based on step type
    action_map = {
        "review_submission": "Review the initial submission details and verify completeness",
        "verify_identity": "Verify identity documents and supporting materials",
        "check_credentials": "Verify credentials against authoritative sources",
        "review_evidence": "Review and validate all evidence attachments",
        "request_info_if_needed": "Request additional information if gaps exist in the submission",
        "make_determination": "Make a final determination on the case",
        "add_note": "Add review notes documenting your findings",
        "set_status": "Update the case status to reflect current progress",
        # Ohio TDDD specific
        "validate_tddd_license": "Verify Ohio TDDD license is active and valid",
        "verify_category_authorization": "Confirm TDDD category matches requested substances",
        "validate_responsible_pharmacist": "Verify designated responsible pharmacist credentials",
        "inspect_storage_security": "Review storage facility security compliance",
        "review_inspection_history": "Check recent inspection findings and violations",
        "verify_dispensing_protocol": "Confirm written dispensing protocols are documented",
        "validate_wholesale_records": "Verify wholesale distribution records compliance",
        "check_biennial_renewal": "Verify renewal status and expiration date",
        "verify_oarrs_reporting": "Confirm OARRS reporting compliance",
        "review_staff_training": "Verify staff training documentation",
        # NY Pharmacy License specific
        "validate_pharmacy_license": "Verify New York pharmacy license is active",
        "verify_pharmacist_in_charge": "Confirm pharmacist-in-charge has active NY license",
        "validate_nysdoh_registration": "Verify NYSDOH registration is current",
        "verify_bne_registration": "Confirm BNE controlled substance registration",
        "inspect_facility_standards": "Review facility inspection reports for compliance",
        "verify_istop_compliance": "Confirm I-STOP PDMP compliance",
        "check_staffing_ratios": "Verify pharmacist-technician staffing ratios",
        "validate_prescription_records": "Verify prescription record retention compliance",
        "verify_compounding_registration": "Check compounding registration if applicable",
        "check_triennial_renewal": "Verify triennial renewal status",
        # CSF Facility specific
        "validate_facility_dea": "Verify facility DEA registration is active",
        "validate_state_license": "Confirm state healthcare facility license",
        "verify_responsible_person": "Verify designated responsible pharmacist or physician",
        "validate_recordkeeping": "Verify controlled substance recordkeeping system",
        "check_biennial_inventory": "Verify biennial inventory compliance",
        "review_diversion_program": "Confirm diversion prevention policies and procedures",
        "verify_staff_training": "Verify staff training documentation",
        "validate_theft_procedures": "Confirm theft/loss reporting procedures",
        "check_dea_renewal": "Verify DEA registration renewal status",
        # Common final steps
        "final_disposition": "Make final decision and communicate outcome to applicant",
    }
    
    suggested_action = action_map.get(
        step_id,
        f"Complete the step: {step['title']}"
    )
    
    return {
        "stepId": step_id,
        "stepTitle": step["title"],
        "suggestedAction": suggested_action,
    }


# ============================================================================
# Repository Function
# ============================================================================

def get_case_adherence(case_id: str) -> Optional[Dict[str, Any]]:
    """
    Get adherence metrics for a case.
    
    Args:
        case_id: Case ID
        
    Returns:
        Adherence metrics or None if case not found
    """
    # Get case to determine decision type
    query = """
        SELECT id, decision_type, status
        FROM cases
        WHERE id = :case_id
    """
    
    results = execute_sql(query, {"case_id": case_id})
    rows = list(results)
    
    if not rows:
        return None
    
    case = dict(rows[0])
    decision_type = case["decision_type"]
    
    # Calculate adherence
    adherence = calculate_adherence(case_id, decision_type)
    
    return adherence
