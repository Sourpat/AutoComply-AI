from src.autocomply.domain.submissions.canonical import CanonicalSubmission
from src.autocomply.domain.submissions.validate import validate_canonical


def test_validate_practitioner_missing_dea() -> None:
    canonical = CanonicalSubmission(
        submission_id="sub-1",
        kind="csf_practitioner",
        jurisdiction="OH",
        entity_type="practitioner",
        identifiers={"dea_number": None},
        expirations={},
        schedules=[],
        attestations={},
        documents=[],
        raw={},
    )

    missing = validate_canonical(canonical)
    missing_keys = {(field.key, field.category) for field in missing}
    assert ("dea_number", "BLOCK") in missing_keys


def test_validate_ohio_hospital_missing_tddd() -> None:
    canonical = CanonicalSubmission(
        submission_id="sub-2",
        kind="csf_hospital_ohio",
        jurisdiction="OH",
        entity_type="hospital",
        identifiers={"tddd_cert": None},
        expirations={},
        schedules=[],
        attestations={},
        documents=[],
        raw={},
    )

    missing = validate_canonical(canonical)
    missing_keys = {(field.key, field.category) for field in missing}
    assert ("tddd_cert", "BLOCK") in missing_keys
