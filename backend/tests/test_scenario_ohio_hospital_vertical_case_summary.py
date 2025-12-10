from conftest import client
from tests.test_scenario_ohio_hospital_schedule_ii import (
    make_ohio_hospital_csf_payload,
    make_ohio_tddd_payload_from_csf,
)
from src.autocomply.audit.decision_log import get_decision_log
from src.autocomply.domain.trace import TRACE_HEADER_NAME


def _extract_trace_id_from_response(resp) -> str | None:
    """
    Mirror the same strategy used in tests/test_decision_trace_id.py
    so we use the *actual* trace id the system emits.
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

    return None


def test_ohio_hospital_vertical_has_coherent_case_summary() -> None:
    """
    End-to-end vertical for Ohio hospital Schedule II scenario:

    1) Evaluate Hospital CSF.
    2) Ask CSF form copilot for explanation.
    3) Evaluate Ohio TDDD license.
    4) (Optionally) run mock order approval.
    5) Retrieve the Compliance Case Summary for the same trace_id.

    Expectations:
    - CSF and Ohio TDDD decisions are ok_to_ship in this happy path.
    - CSF copilot response includes RAG/regs fields.
    - Case summary aggregates both engines and regulatory references.
    """

    # --- Step 1: Hospital CSF evaluation ---
    csf_payload = make_ohio_hospital_csf_payload()
    csf_eval_resp = client.post("/csf/hospital/evaluate", json=csf_payload)
    assert csf_eval_resp.status_code == 200

    csf_eval_data = csf_eval_resp.json()
    assert csf_eval_data["status"] == "ok_to_ship"
    assert "reason" in csf_eval_data

    trace_id = _extract_trace_id_from_response(csf_eval_resp)
    assert trace_id, "Expected CSF evaluation to emit a trace_id"
    headers = {TRACE_HEADER_NAME: trace_id}

    # --- Step 2: CSF Form Copilot explanation ---
    csf_copilot_resp = client.post(
        "/csf/hospital/form-copilot",
        json=csf_payload,
        headers=headers,
    )
    assert csf_copilot_resp.status_code == 200
    csf_copilot_data = csf_copilot_resp.json()

    for key in [
        "status",
        "reason",
        "missing_fields",
        "regulatory_references",
        "rag_explanation",
        "artifacts_used",
        "rag_sources",
    ]:
        assert key in csf_copilot_data

    assert csf_copilot_data["status"] == "ok_to_ship"
    assert isinstance(csf_copilot_data["regulatory_references"], list)
    assert len(csf_copilot_data["rag_sources"]) >= 1

    # --- Step 3: Ohio TDDD license evaluation ---
    ohio_tddd_payload = make_ohio_tddd_payload_from_csf(csf_payload)
    tddd_eval_resp = client.post(
        "/license/ohio-tddd/evaluate",
        json=ohio_tddd_payload,
        headers=headers,
    )
    assert tddd_eval_resp.status_code == 200
    tddd_eval_data = tddd_eval_resp.json()

    assert tddd_eval_data["status"] == "ok_to_ship"
    assert "reason" in tddd_eval_data
    for optional_key in [
        "regulatory_references",
        "artifacts_used",
        "rag_sources",
    ]:
        if optional_key in tddd_eval_data:
            assert isinstance(tddd_eval_data[optional_key], list)

    # --- Step 4: (Optional) run mock order approval endpoint ---
    order_resp = client.get("/orders/mock/ohio-hospital-approval", headers=headers)
    assert order_resp.status_code == 200
    order_data = order_resp.json()
    assert "decision" in order_data
    assert order_data["decision"]["status"] in {
        "ok_to_ship",
        "needs_review",
        "blocked",
    }

    tddd_trace_id = _extract_trace_id_from_response(tddd_eval_resp)
    if tddd_trace_id:
        assert tddd_trace_id == trace_id
    order_trace_id = _extract_trace_id_from_response(order_resp)
    if order_trace_id:
        assert order_trace_id == trace_id

    # --- Step 5: derive trace_id (mirroring test_decision_trace_id) ---
    trace_id = (
        _extract_trace_id_from_response(order_resp)
        or _extract_trace_id_from_response(csf_eval_resp)
        or _extract_trace_id_from_response(tddd_eval_resp)
    )
    assert trace_id, "Expected a trace_id from one of the responses"

    # Sanity check: we actually recorded something for this trace in the log
    log = get_decision_log()
    entries = log.get_entries_for_trace(trace_id)
    assert entries, "Expected decision log entries for this trace_id"

    # --- Step 6: Case summary for this trace ---
    summary_resp = client.get(f"/cases/summary/{trace_id}")
    assert summary_resp.status_code == 200
    summary_data = summary_resp.json()

    assert summary_data["trace_id"] == trace_id
    assert summary_data["overall_status"] in {
        "ok_to_ship",
        "needs_review",
        "blocked",
    }
    assert summary_data["overall_status"] == "ok_to_ship"

    decisions = summary_data["decisions"]
    assert isinstance(decisions, list)
    assert len(decisions) >= 2

    engine_pairs = {(d["engine_family"], d["decision_type"]) for d in decisions}
    assert any(
        ef == "csf" and "csf_hospital" in dt for ef, dt in engine_pairs
    ), engine_pairs
    assert any(
        ef == "license" and "ohio_tddd" in dt for ef, dt in engine_pairs
    ), engine_pairs

    regs = summary_data.get("regulatory_references") or []
    assert isinstance(regs, list)
    assert len(regs) >= 1
    reg_ids = set(regs)
    assert "csf_hospital_form" in reg_ids
    assert {"ohio_tddd_rules", "ohio-tddd-core"} & reg_ids

    rag_sources = summary_data.get("rag_sources") or []
    assert isinstance(rag_sources, list)
    if rag_sources:
        assert "id" in rag_sources[0]
