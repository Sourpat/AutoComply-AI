#!/usr/bin/env python
"""
Simple HTTP smoke test for the AutoComply AI backend.

This script:
- Hits /health
- Sends a minimal Hospital CSF evaluate request
- Sends a minimal Ohio TDDD evaluate request
- Sends a minimal NY Pharmacy evaluate request
- Calls the Ohio Hospital mock order endpoint
- Calls the Ohio Facility mock order endpoint
- Calls the NY Pharmacy license-only mock order endpoint

It prints a summary table of pass/fail for each check.

Usage:
    python scripts/smoke_test_autocomply.py --base-url http://localhost:8000
    python scripts/smoke_test_autocomply.py --base-url https://your-render-backend
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class CheckResult:
    name: str
    endpoint: str
    ok: bool
    status_code: Optional[int]
    detail: str


def _request_json(
    base_url: str,
    path: str,
    method: str = "GET",
    body: Optional[Dict[str, Any]] = None,
) -> Tuple[int, Dict[str, Any]]:
    url = base_url.rstrip("/") + path
    headers = {"Content-Type": "application/json"}

    data = json.dumps(body).encode("utf-8") if body is not None else None

    req = urllib.request.Request(url, data=data, headers=headers, method=method.upper())

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.getcode()
            resp_body = resp.read().decode("utf-8") or "{}"
            try:
                payload = json.loads(resp_body)
            except json.JSONDecodeError:
                payload = {"_raw": resp_body}
            return status, payload
    except urllib.error.HTTPError as e:
        status = e.code
        raw = e.read().decode("utf-8") or ""
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"_raw": raw}
        return status, payload
    except Exception as e:  # noqa: B902
        raise RuntimeError(f"Request to {url} failed: {e}") from e


def check_health(base_url: str) -> CheckResult:
    try:
        status, payload = _request_json(base_url, "/health", "GET")
        ok = status == 200 and payload.get("status") == "ok"
        detail = f"status={payload.get('status')}, service={payload.get('service')}"
        return CheckResult(
            name="health",
            endpoint="/health",
            ok=ok,
            status_code=status,
            detail=detail,
        )
    except Exception as e:
        return CheckResult(
            name="health",
            endpoint="/health",
            ok=False,
            status_code=None,
            detail=str(e),
        )


def check_health_full(base_url: str) -> CheckResult:
    try:
        status, payload = _request_json(base_url, "/health/full", "GET")
        ok = status == 200 and payload.get("status") == "ok"
        detail = f"status={payload.get('status')}, components={list((payload.get('components') or {}).keys())}"
        return CheckResult(
            name="health_full",
            endpoint="/health/full",
            ok=ok,
            status_code=status,
            detail=detail,
        )
    except Exception as e:
        return CheckResult(
            name="health_full",
            endpoint="/health/full",
            ok=False,
            status_code=None,
            detail=str(e),
        )


def make_hospital_csf_payload() -> Dict[str, Any]:
    return {
        "facility_name": "Ohio General Hospital",
        "facility_type": "hospital",
        "account_number": "800123456",
        "pharmacy_license_number": "LIC-12345",
        "dea_number": "AB1234567",
        "pharmacist_in_charge_name": "Dr. Jane Doe",
        "pharmacist_contact_phone": "555-123-4567",
        "ship_to_state": "OH",
        "attestation_accepted": True,
        "internal_notes": "Smoke test – hospital CSF.",
        "controlled_substances": [
            {
                "id": "cs-oxy-5mg-tab",
                "name": "Oxycodone 5 mg tablet",
                "ndc": "12345-6789-01",
                "strength": "5 mg",
                "dosage_form": "tablet",
                "dea_schedule": "II",
            }
        ],
    }


def check_csf_hospital(base_url: str) -> CheckResult:
    payload = make_hospital_csf_payload()
    try:
        status, body = _request_json(base_url, "/csf/hospital/evaluate", "POST", payload)
        ok = status == 200 and body.get("status") in {"ok_to_ship", "needs_review", "blocked"}
        detail = f"status={body.get('status')}, reason={body.get('reason')}"
        return CheckResult(
            name="csf_hospital_evaluate",
            endpoint="/csf/hospital/evaluate",
            ok=ok,
            status_code=status,
            detail=detail,
        )
    except Exception as e:
        return CheckResult(
            name="csf_hospital_evaluate",
            endpoint="/csf/hospital/evaluate",
            ok=False,
            status_code=None,
            detail=str(e),
        )


def make_ohio_tddd_payload() -> Dict[str, Any]:
    return {
        "tddd_number": "01234567",
        "facility_name": "Ohio General Hospital",
        "account_number": "800123456",
        "ship_to_state": "OH",
        "license_type": "ohio_tddd",
        "attestation_accepted": True,
        "internal_notes": "Smoke test – Ohio TDDD.",
    }


def check_ohio_tddd(base_url: str) -> CheckResult:
    payload = make_ohio_tddd_payload()
    try:
        status, body = _request_json(base_url, "/license/ohio-tddd/evaluate", "POST", payload)
        ok = status == 200 and body.get("status") in {"ok_to_ship", "needs_review", "blocked"}
        detail = f"status={body.get('status')}, reason={body.get('reason')}"
        return CheckResult(
            name="license_ohio_tddd_evaluate",
            endpoint="/license/ohio-tddd/evaluate",
            ok=ok,
            status_code=status,
            detail=detail,
        )
    except Exception as e:
        return CheckResult(
            name="license_ohio_tddd_evaluate",
            endpoint="/license/ohio-tddd/evaluate",
            ok=False,
            status_code=None,
            detail=str(e),
        )


def make_ny_pharmacy_payload(valid: bool = True) -> Dict[str, Any]:
    if valid:
        return {
            "pharmacy_name": "Manhattan Pharmacy",
            "account_number": "900123456",
            "ship_to_state": "NY",
            "dea_number": "FG1234567",
            "ny_state_license_number": "NYPHARM-001234",
            "attestation_accepted": True,
            "internal_notes": "Smoke test – NY Pharmacy.",
        }

    return {
        "pharmacy_name": "Manhattan Pharmacy",
        "account_number": "900123456",
        "ship_to_state": "NJ",
        "dea_number": "FG1234567",
        "ny_state_license_number": "",
        "attestation_accepted": False,
        "internal_notes": "Smoke test – NY Pharmacy (negative).",
    }


def check_ny_pharmacy(base_url: str) -> CheckResult:
    payload = make_ny_pharmacy_payload(valid=True)
    try:
        status, body = _request_json(base_url, "/license/ny-pharmacy/evaluate", "POST", payload)
        ok = status == 200 and body.get("status") in {"ok_to_ship", "needs_review", "blocked"}
        detail = f"status={body.get('status')}, reason={body.get('reason')}"
        return CheckResult(
            name="license_ny_pharmacy_evaluate",
            endpoint="/license/ny-pharmacy/evaluate",
            ok=ok,
            status_code=status,
            detail=detail,
        )
    except Exception as e:
        return CheckResult(
            name="license_ny_pharmacy_evaluate",
            endpoint="/license/ny-pharmacy/evaluate",
            ok=False,
            status_code=None,
            detail=str(e),
        )


def check_ohio_hospital_order(base_url: str) -> CheckResult:
    csf_payload = make_hospital_csf_payload()
    tddd_payload = make_ohio_tddd_payload()
    body = {
        "hospital_csf": csf_payload,
        "ohio_tddd": tddd_payload,
    }
    try:
        status, resp = _request_json(
            base_url, "/orders/mock/ohio-hospital-approval", "POST", body
        )
        final = resp.get("final_decision")
        ok = status == 200 and final in {"ok_to_ship", "needs_review", "blocked"}
        detail = f"final_decision={final}"
        return CheckResult(
            name="order_mock_ohio_hospital",
            endpoint="/orders/mock/ohio-hospital-approval",
            ok=ok,
            status_code=status,
            detail=detail,
        )
    except Exception as e:
        return CheckResult(
            name="order_mock_ohio_hospital",
            endpoint="/orders/mock/ohio-hospital-approval",
            ok=False,
            status_code=None,
            detail=str(e),
        )


def check_ohio_facility_order(base_url: str) -> CheckResult:
    body = {
        "facility_csf_decision": "ok_to_ship",
        "ohio_tddd_decision": "ok_to_ship",
    }
    try:
        status, resp = _request_json(
            base_url, "/orders/mock/ohio-facility-approval", "POST", body
        )
        final = resp.get("final_decision")
        ok = status == 200 and final in {"ok_to_ship", "needs_review", "blocked"}
        detail = f"final_decision={final}"
        return CheckResult(
            name="order_mock_ohio_facility",
            endpoint="/orders/mock/ohio-facility-approval",
            ok=ok,
            status_code=status,
            detail=detail,
        )
    except Exception as e:
        return CheckResult(
            name="order_mock_ohio_facility",
            endpoint="/orders/mock/ohio-facility-approval",
            ok=False,
            status_code=None,
            detail=str(e),
        )


def check_ny_pharmacy_order(base_url: str) -> CheckResult:
    ny_payload = make_ny_pharmacy_payload(valid=True)
    body = {"ny_pharmacy": ny_payload}
    try:
        status, resp = _request_json(
            base_url, "/orders/mock/ny-pharmacy-approval", "POST", body
        )
        final = resp.get("final_decision")
        ok = status == 200 and final in {"ok_to_ship", "needs_review", "blocked"}
        detail = f"final_decision={final}, license_status={resp.get('license_status')}"
        return CheckResult(
            name="order_mock_ny_pharmacy",
            endpoint="/orders/mock/ny-pharmacy-approval",
            ok=ok,
            status_code=status,
            detail=detail,
        )
    except Exception as e:
        return CheckResult(
            name="order_mock_ny_pharmacy",
            endpoint="/orders/mock/ny-pharmacy-approval",
            ok=False,
            status_code=None,
            detail=str(e),
        )


def _print_summary(results: List[CheckResult]) -> None:
    print("\nAutoComply AI – HTTP Smoke Test Summary\n")
    print(f"{'Check':30} {'OK?':5} {'HTTP':6} Detail")
    print("-" * 80)
    for r in results:
        http = str(r.status_code) if r.status_code is not None else "-"
        ok_str = "✅" if r.ok else "❌"
        print(f"{r.name:30} {ok_str:5} {http:6} {r.detail}")
    print("-" * 80)

    if all(r.ok for r in results):
        print("Overall result: ✅ all checks passed.")
    else:
        print("Overall result: ❌ some checks failed.")
        print("Investigate the failing checks above.")


def main(argv: List[str]) -> int:
    parser = argparse.ArgumentParser(
        description="HTTP smoke test for AutoComply AI backend."
    )
    parser.add_argument(
        "--base-url",
        default="http://localhost:8000",
        help="Base URL of the FastAPI backend (default: http://localhost:8000)",
    )
    args = parser.parse_args(argv)

    base_url = args.base_url.rstrip("/")
    print(f"Running smoke tests against: {base_url}")

    checks = [
        check_health(base_url),
        check_health_full(base_url),
        check_csf_hospital(base_url),
        check_ohio_tddd(base_url),
        check_ny_pharmacy(base_url),
        check_ohio_hospital_order(base_url),
        check_ohio_facility_order(base_url),
        check_ny_pharmacy_order(base_url),
    ]

    _print_summary(checks)

    return 0 if all(c.ok for c in checks) else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
