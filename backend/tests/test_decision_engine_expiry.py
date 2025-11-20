import sys
from datetime import date, timedelta
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.compliance.decision_engine import evaluate_expiry, ExpiryEvaluation


def test_evaluate_expiry_expired():
    today = date(2025, 1, 10)
    expired_date = today - timedelta(days=1)

    result = evaluate_expiry(expiry_date=expired_date, today=today, near_expiry_window_days=30)

    assert isinstance(result, ExpiryEvaluation)
    assert result.is_expired is True
    assert result.bucket == "expired"
    # For expired we don't care about days_to_expiry
    assert result.days_to_expiry is None


def test_evaluate_expiry_near_expiry_within_window():
    today = date(2025, 1, 10)
    near_date = today + timedelta(days=7)

    result = evaluate_expiry(expiry_date=near_date, today=today, near_expiry_window_days=30)

    assert result.is_expired is False
    assert result.bucket == "near_expiry"
    assert result.days_to_expiry == 7


def test_evaluate_expiry_active_outside_window():
    today = date(2025, 1, 10)
    active_date = today + timedelta(days=60)

    result = evaluate_expiry(expiry_date=active_date, today=today, near_expiry_window_days=30)

    assert result.is_expired is False
    assert result.bucket == "active"
    assert result.days_to_expiry == 60
