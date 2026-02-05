from src.autocomply.domain.explainability.drift import detect_drift


def _run_record(
    submission_hash: str = "hash-1",
    policy_version: str = "policy-v1",
    knowledge_version: str = "kb-v1",
    engine_version: str = "explain-engine-v1",
) -> dict:
    return {
        "run_id": "run-1",
        "submission_id": "sub-1",
        "submission_hash": submission_hash,
        "policy_version": policy_version,
        "knowledge_version": knowledge_version,
        "status": "approved",
        "risk": "low",
        "payload": {
            "debug": {"engine_version": engine_version},
            "missing_fields": [],
            "fired_rules": [],
        },
    }


def test_detect_drift_same_runs() -> None:
    run_a = _run_record()
    run_b = _run_record()
    drift = detect_drift(run_a, run_b)
    assert drift.changed is False


def test_detect_drift_policy_change() -> None:
    run_a = _run_record(policy_version="policy-v1")
    run_b = _run_record(policy_version="policy-v2")
    drift = detect_drift(run_a, run_b)
    assert drift.changed is True
    assert drift.reason == "policy"


def test_detect_drift_knowledge_change() -> None:
    run_a = _run_record(knowledge_version="kb-v1")
    run_b = _run_record(knowledge_version="kb-v2")
    drift = detect_drift(run_a, run_b)
    assert drift.changed is True
    assert drift.reason == "knowledge"
