from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


class ArtifactType(str, Enum):
    STATE_ATTESTATION = "state_attestation"
    CONTROLLED_SUBSTANCE_FORM = "controlled_substance_form"
    ADDENDUM = "addendum"


class ArtifactStatus(str, Enum):
    RAW_DOCUMENT = "raw_document"  # just PDF/HTML
    MODELLED = "modelled"  # domain model exists
    API_EXPOSED = "api_exposed"  # endpoint exists
    UI_SANDBOX = "ui_sandbox"  # there is a sandbox panel
    FULL_LOOP = "full_loop"  # model + API + UI + Codex explain


class ComplianceArtifact(BaseModel):
    id: str
    name: str
    jurisdiction: Optional[str]
    artifact_type: ArtifactType
    source_document: Optional[str] = None  # path or URL to the source doc
    engine_status: ArtifactStatus
    notes: Optional[str] = None


# Static registry for now – later can be DB-backed or config-driven
COMPLIANCE_ARTIFACTS: List[ComplianceArtifact] = [
    # 1) Ohio TDDD – fully wired (model + API + UI + Codex)
    ComplianceArtifact(
        id="ohio_tddd",
        name="Ohio TDDD Attestation",
        jurisdiction="US-OH",
        artifact_type=ArtifactType.STATE_ATTESTATION,
        source_document="/mnt/data/Ohio TDDD.html",
        engine_status=ArtifactStatus.FULL_LOOP,
        notes="Modeled in ohio_tddd.py with /ohio-tddd/evaluate + sandbox + Codex explanation.",
    ),
    # 2) Controlled Substance Forms – Practitioner, Hospital, Surgery, EMS, Researcher
    ComplianceArtifact(
        id="csf_practitioner",
        name="Controlled Substance Form – Practitioner",
        jurisdiction="US-Federal/General",
        artifact_type=ArtifactType.CONTROLLED_SUBSTANCE_FORM,
        source_document="/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf",
        engine_status=ArtifactStatus.UI_SANDBOX,
        notes=(
            "Practitioner CSF modeled in csf_practitioner.py with /csf/practitioner/"
            "evaluate and sandbox UI."
        ),
    ),
    ComplianceArtifact(
        id="csf_hospital",
        name="Controlled Substance Form – Hospital Pharmacy",
        jurisdiction="US-Federal/General",
        artifact_type=ArtifactType.CONTROLLED_SUBSTANCE_FORM,
        source_document="/mnt/data/Online Controlled Substance Form - Hospital Pharmacy.pdf",
        engine_status=ArtifactStatus.UI_SANDBOX,
        notes=(
            "Hospital CSF modeled in csf_hospital.py with /csf/hospital/evaluate "
            "and sandbox UI."
        ),
    ),
    ComplianceArtifact(
        id="csf_surgery_center",
        name="Controlled Substance Form – Surgery Center",
        jurisdiction="US-Federal/General",
        artifact_type=ArtifactType.CONTROLLED_SUBSTANCE_FORM,
        source_document="/mnt/data/Online Controlled Substance Form - Surgery Center form.pdf",
        engine_status=ArtifactStatus.MODELLED,
        notes=(
            "Surgery Center CSF modeled in csf_surgery_center.py with evaluation logic "
            "for facility license, DEA, medical director, and attestation."
        ),
    ),
    ComplianceArtifact(
        id="csf_ems",
        name="Controlled Substance Form – EMS",
        jurisdiction="US-Federal/General",
        artifact_type=ArtifactType.CONTROLLED_SUBSTANCE_FORM,
        source_document="/mnt/data/Online Controlled Substance Form - EMS form.pdf",
        engine_status=ArtifactStatus.MODELLED,
        notes=(
            "EMS CSF modeled in csf_ems.py with evaluation logic for service identity, "
            "agency license, medical director, and attestation."
        ),
    ),
    ComplianceArtifact(
        id="csf_researcher",
        name="Controlled Substance Form – Researcher",
        jurisdiction="US-Federal/General",
        artifact_type=ArtifactType.CONTROLLED_SUBSTANCE_FORM,
        source_document="/mnt/data/Online Controlled Substance Form - Researcher form.pdf",
        engine_status=ArtifactStatus.UI_SANDBOX,
        notes=(
            "Researcher CSF modeled in csf_researcher.py with "
            "/csf/researcher/evaluate and sandbox UI."
        ),
    ),
    # 3) Addendums bundle
    ComplianceArtifact(
        id="csf_addendums",
        name="Controlled Substance Forms – Multi-state Addendums",
        jurisdiction="US-Multi",
        artifact_type=ArtifactType.ADDENDUM,
        source_document="/mnt/data/addendums.pdf",
        engine_status=ArtifactStatus.RAW_DOCUMENT,
        notes=(
            "Bundle of state-specific CSF addendums. Florida-specific content is "
            "also represented explicitly via csf_fl_addendum."
        ),
    ),
    ComplianceArtifact(
        id="csf_fl_addendum",
        name="Controlled Substance Form – Florida Addendum",
        jurisdiction="US-FL",
        artifact_type=ArtifactType.ADDENDUM,
        source_document="/mnt/data/FLORIDA TEST.pdf",
        engine_status=ArtifactStatus.RAW_DOCUMENT,
        notes=(
            "Florida-specific controlled substances addendum for CSF flows. "
            "Item-aware engine rules that send Schedule II controlled substances "
            "shipping to FL to manual_review are derived from this artifact."
        ),
    ),
    # Florida-specific placeholder doc (legacy/testing)
    ComplianceArtifact(
        id="florida_test",
        name="Florida Controlled Substance Test Doc",
        jurisdiction="US-FL",
        artifact_type=ArtifactType.ADDENDUM,
        source_document="/mnt/data/FLORIDA TEST.pdf",
        engine_status=ArtifactStatus.RAW_DOCUMENT,
        notes="Placeholder for Florida-specific controlled substance logic.",
    ),
]
