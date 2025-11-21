from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

from src.utils.logger import get_logger


logger = get_logger(__name__)


@dataclass
class EventPublisherConfig:
    """
    Configuration for the EventPublisher.

    In a future version, this may include:
      - n8n base URL
      - separate webhook paths for Slack, email, audit logging
      - API keys or auth headers

    For now, this is deliberately minimal and designed not to perform
    real network calls unless explicitly configured.
    """

    n8n_base_url: Optional[str] = None
    slack_webhook_path: Optional[str] = None

    @classmethod
    def from_env(cls) -> "EventPublisherConfig":
        """
        Build configuration from environment variables.

        If values are missing, the publisher will operate in a safe,
        no-op mode.
        """
        return cls(
            n8n_base_url=os.getenv("AUTOCOMPLY_N8N_BASE_URL"),
            slack_webhook_path=os.getenv("AUTOCOMPLY_N8N_SLACK_WEBHOOK_PATH"),
        )

    @property
    def is_slack_enabled(self) -> bool:
        return bool(self.n8n_base_url and self.slack_webhook_path)


class EventPublisher:
    """
    Stub event publisher for AutoComply AI.

    Responsibilities:
      - Build structured event payloads for license decisions.
      - Optionally send them to an automation layer (n8n, Slack, etc.).
      - Operate as a NO-OP when not configured, so tests and local
        dev are always safe.

    NOTE: Currently, this class does NOT perform any real HTTP calls.
    It only logs the event payload when configuration is present.
    The HTTP implementation can be added later without changing the
    public API or callers.
    """

    def __init__(self, config: Optional[EventPublisherConfig] = None) -> None:
        self.config = config or EventPublisherConfig.from_env()

    def build_license_event(
        self,
        success: bool,
        license_id: Optional[str],
        state: Optional[str],
        allow_checkout: bool,
        reason: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Build a normalized event payload for a license validation.

        Args:
            success: Overall success flag for the validation call.
            license_id: Identifier for the license, if available.
            state: State / jurisdiction code (e.g. 'CA').
            allow_checkout: Decision outcome for checkout.
            reason: Optional human-readable reason.
            extra: Optional extra metadata to include.

        Returns:
            Dict suitable for sending to n8n / Slack / logging.
        """
        payload: Dict[str, Any] = {
            "event": "license_validation",
            "success": success,
            "license_id": license_id,
            "state": state,
            "allow_checkout": allow_checkout,
        }

        if reason:
            payload["reason"] = reason

        if extra:
            payload["extra"] = extra

        return payload

    def publish_license_event(
        self,
        success: bool,
        license_id: Optional[str],
        state: Optional[str],
        allow_checkout: bool,
        reason: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Publish a license validation event.

        Current behavior:
          - If Slack/n8n config is missing → NO-OP, returns False.
          - If config is present → logs the payload and returns True.

        Future behavior:
          - Perform an HTTP POST to the n8n Slack webhook with the event
            payload, with retries and error handling.
        """
        event_payload = self.build_license_event(
            success=success,
            license_id=license_id,
            state=state,
            allow_checkout=allow_checkout,
            reason=reason,
            extra=extra,
        )

        if not self.config.is_slack_enabled:
            logger.debug(
                "EventPublisher in NO-OP mode (Slack disabled). Payload=%s",
                json.dumps(event_payload),
            )
            return False

        # For now, we only log the event. This is intentionally a stub so
        # tests and local dev do not depend on external services.
        logger.info(
            "EventPublisher would send Slack/n8n event: %s",
            json.dumps(event_payload),
        )

        # Placeholder for future HTTP call:
        #   httpx.post(...)
        return True

    async def send_slack_alert(self, payload: Dict[str, Any]) -> None:
        """
        Backwards-compatible async stub used by API routes.

        The JSON license validation endpoint currently does:

            asyncio.create_task(publisher.send_slack_alert(payload))

        This method ensures:
          - No network calls are made.
          - The endpoint never crashes due to missing Slack config.
          - We can later replace this with a real HTTP POST to n8n/Slack.

        Args:
            payload: Arbitrary dict containing event data. The route
                     currently passes keys like:
                       - event
                       - success
                       - license_id
                       - state
                       - allow_checkout
        """
        if not isinstance(payload, dict):
            logger.warning(
                "send_slack_alert received non-dict payload: %r",
                payload,
            )
            return

        if not self.config.is_slack_enabled:
            # NO-OP mode: just log at debug level so tests and local dev
            # never depend on external services.
            logger.debug(
                "Slack alert (NO-OP, Slack disabled). Payload=%s",
                json.dumps(payload),
            )
            return

        # In a future implementation, this is where we'd POST to n8n/Slack.
        logger.info(
            "Slack alert stub (would send to n8n/Slack): %s",
            json.dumps(payload),
        )

# ---------------------------------------------------------------------------
# Convenience factory for importing code
# ---------------------------------------------------------------------------

# Module-level singleton so callers can simply do:
#   from src.utils.events import get_event_publisher
#   publisher = get_event_publisher()
# without worrying about config wiring.
_publisher_instance: Optional[EventPublisher] = None


def get_event_publisher() -> EventPublisher:
    """
    Return a shared EventPublisher instance.

    This keeps the import pattern used in the API routes and tests
    (`from src.utils.events import get_event_publisher`) working,
    while still allowing tests to inject custom configs by directly
    instantiating EventPublisher/EventPublisherConfig when needed.
    """
    global _publisher_instance
    if _publisher_instance is None:
        _publisher_instance = EventPublisher()
    return _publisher_instance
