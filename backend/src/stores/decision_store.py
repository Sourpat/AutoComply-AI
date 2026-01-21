"""
Decision Store - Saves last decision payload for each engine family/type.

Supports:
- In-memory storage for fast access
- JSON file persistence for durability across restarts
- Simple key-based storage (e.g., "csf:csf_practitioner")
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from src.utils.logger import get_logger

logger = get_logger(__name__)


class DecisionStore:
    """Store for persisting last decision payloads by engine family and type."""

    def __init__(self, persist_path: Optional[str] = None):
        """
        Initialize DecisionStore.

        Args:
            persist_path: Path to JSON file for persistence.
                         Defaults to backend/data/decision_store.json
        """
        self._store: Dict[str, Dict[str, Any]] = {}

        if persist_path is None:
            # Default to backend/data/decision_store.json
            backend_dir = Path(__file__).parent.parent.parent
            data_dir = backend_dir / "data"
            data_dir.mkdir(exist_ok=True)
            persist_path = str(data_dir / "decision_store.json")

        self.persist_path = persist_path
        self._load_from_disk()

    def _load_from_disk(self) -> None:
        """Load stored decisions from JSON file if it exists."""
        if not os.path.exists(self.persist_path):
            logger.info("No persisted decision store found, starting fresh")
            return

        try:
            with open(self.persist_path, "r", encoding="utf-8") as f:
                self._store = json.load(f)
            logger.info(f"Loaded {len(self._store)} decisions from {self.persist_path}")
        except Exception as e:
            logger.error(f"Failed to load decision store: {e}")
            self._store = {}

    def _save_to_disk(self) -> None:
        """Persist current store to JSON file."""
        try:
            with open(self.persist_path, "w", encoding="utf-8") as f:
                json.dump(self._store, f, indent=2, default=str)
            logger.info(f"Persisted decision store to {self.persist_path}")
        except Exception as e:
            logger.error(f"Failed to persist decision store: {e}")

    def _make_key(self, engine_family: str, decision_type: str) -> str:
        """Create storage key from engine_family and decision_type."""
        return f"{engine_family}:{decision_type}"

    def save_decision(
        self,
        engine_family: str,
        decision_type: str,
        evidence: Dict[str, Any],
        meta: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Save a decision payload.

        Args:
            engine_family: e.g., "csf", "license"
            decision_type: e.g., "csf_practitioner", "license_dea"
            evidence: The evidence dictionary used for decision
            meta: Optional metadata (e.g., form data, decision outcome)
        """
        key = self._make_key(engine_family, decision_type)
        
        self._store[key] = {
            "engine_family": engine_family,
            "decision_type": decision_type,
            "saved_at": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            "evidence": evidence,
            "meta": meta or {},
        }

        self._save_to_disk()
        logger.info(f"Saved decision for {key}")

    def get_last_decision(
        self,
        engine_family: str,
        decision_type: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve the last saved decision.

        Returns:
            Dictionary with keys: engine_family, decision_type, saved_at, evidence, meta
            Or None if no decision exists.
        """
        key = self._make_key(engine_family, decision_type)
        return self._store.get(key)

    def exists(self, engine_family: str, decision_type: str) -> bool:
        """Check if a decision exists for the given family/type."""
        key = self._make_key(engine_family, decision_type)
        return key in self._store

    def clear(self, engine_family: str, decision_type: str) -> None:
        """Clear a specific decision."""
        key = self._make_key(engine_family, decision_type)
        if key in self._store:
            del self._store[key]
            self._save_to_disk()
            logger.info(f"Cleared decision for {key}")

    def clear_all(self) -> None:
        """Clear all stored decisions."""
        self._store = {}
        self._save_to_disk()
        logger.info("Cleared all decisions")


# Global singleton instance
_decision_store: Optional[DecisionStore] = None


def get_decision_store() -> DecisionStore:
    """Get the global DecisionStore singleton."""
    global _decision_store
    if _decision_store is None:
        _decision_store = DecisionStore()
    return _decision_store
