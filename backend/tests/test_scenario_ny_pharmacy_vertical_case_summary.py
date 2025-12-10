from conftest import client
from src.autocomply.audit.decision_log import get_decision_log
from src.autocomply.domain.scenario_builders import make_ny_pharmacy_license_payload_happy
from src.autocomply.domain.trace import TRACE_HEADER_NAME


def _extract_trace_id_from_response(resp) -> str | None:
    """
    Mirror the same strategy used in tests/test_decision_trace_id.py so we use
    the actual trace id the system emits.
    """
    trace_id = resp.headers.get(TRACE_HEADER_NAME)
    if trace_id:
        return trace_id

    try:
        data = resp.json()
    except Exception:  # pragma: no cover - defensive
        data = {}

    for key in ("trace_id", "decision_trace_id"):
        if isinstance(data, dict) and key in data and data[key]:
            return data[key]

    decision = data.get("decision") if isinstance(data, dict) else None
    if isinstance(decision, dict):
        for key in ("trace_id", "decision_trace_id"):
            if decision.get(key):
                return decision[key]

    return None


def test_ny_pharmacy_vertical_has_coherent_case_summary() -> None:
    """
    End-to-end vertical for NY Pharmacy happy path:

    1) Evaluate NY Pharmacy license.
    2) Run the NY pharmacy mock order approval endpoint.
    3) Retrieve the Compliance Case Summary for the same trace_id.

    Expectations:
    - NY Pharmacy license decision is ok_to_ship in this happy path.
    - Case summary aggregates at least the license engine.
    """

    # --- Step 1: NY Pharmacy license evaluation (happy path) ---
    payload = make_ny_pharmacy_license_payload_happy()
    license_resp = client.post("/license/ny-pharmacy/evaluate", json=payload)
    assert license_resp.status_code == 200

    license_data = license_resp.json()
    license_decision = license_data.get("decision", license_data)
    assert license_decision["status"] in {"ok_to_ship", "needs_review", "blocked"}
    assert license_decision["status"] == "ok_to_ship"
    assert "reason" in license_decision

    trace_id = _extract_trace_id_from_response(license_resp)
    assert trace_id, "Expected license evaluation to emit a trace_id"

    headers = {TRACE_HEADER_NAME: trace_id}

    # --- Step 2: run NY pharmacy mock order approval endpoint ---
    order_resp = client.get("/orders/mock/ny-pharmacy-approval", headers=headers)
    assert order_resp.status_code == 200
    order_data = order_resp.json()
    order_decision = order_data.get("decision", order_data)
    assert "decision" in order_data
    assert order_decision["status"] in {"ok_to_ship", "needs_review", "blocked"}

    order_trace_id = _extract_trace_id_from_response(order_resp)
    if order_trace_id:
        assert order_trace_id == trace_id

    # --- Step 3: derive trace_id (mirroring test_decision_trace_id) ---
    trace_id = _extract_trace_id_from_response(order_resp) or trace_id
    assert trace_id, "Expected a trace_id from one of the responses"

    # Sanity: ensure decision log has entries for this trace
    log = get_decision_log()
    entries = log.get_entries_for_trace(trace_id)
    assert entries, "Expected decision log entries for this trace_id"

    # --- Step 4: Case summary for this trace ---
    summary_resp = client.get(f"/cases/summary/{trace_id}")
    assert summary_resp.status_code == 200
    summary_data = summary_resp.json()

    assert summary_data["trace_id"] == trace_id
    assert summary_data["overall_status"] in {"ok_to_ship", "needs_review", "blocked"}
    assert summary_data["overall_status"] == "ok_to_ship"

    decisions = summary_data["decisions"]
    assert isinstance(decisions, list)
    assert len(decisions) >= 1

    engine_pairs = {(d.get("engine_family"), d.get("decision_type")) for d in decisions}
    assert any(
        ef == "license" and dt and "ny_pharmacy" in dt for ef, dt in engine_pairs
    ), engine_pairs

    regs = summary_data.get("regulatory_references") or []
    assert isinstance(regs, list)
    assert len(regs) >= 1

    rag_sources = summary_data.get("rag_sources") or []
    assert isinstance(rag_sources, list)
    if rag_sources:
        assert "id" in rag_sources[0]
