from __future__ import annotations

from typing import Any, Dict, Optional

import httpx

from src.config import get_settings
from src.utils.logger import get_logger

logger = get_logger("autocomply.events")


class EventPublisher:
    """
    Thin helper to send non-critical events to n8n (Slack alerts, etc.).

    Design goals:
    - Optional: if n8n is not configured, this becomes a no-op.
    - Fire-and-forget: errors are logged, but never break API responses.
    - HTTP-only: no tight coupling to n8n, just a generic webhook call.
    """

    def __init__(
        self,
        base_url: Optional[str],
        slack_webhook_path: Optional[str],
        timeout_seconds: float = 5.0,
    ) -> None:
        self.base_url = base_url.rstrip("/") if base_url else None
        self.slack_webhook_path = slack_webhook_path
        self.timeout_seconds = timeout_seconds

        if not self.base_url or not self.slack_webhook_path:
            logger.info(
                "EventPublisher initialized in NO-OP mode "
                "(missing AUTOCOMPLY_N8N_BASE_URL or AUTOCOMPLY_N8N_SLACK_WEBHOOK_PATH)."
            )

    def _is_enabled(self) -> bool:
        return bool(self.base_url and self.slack_webhook_path)

    async def send_slack_alert(self, payload: Dict[str, Any]) -> None:
        """
        Asynchronously send a generic JSON payload to the configured n8n webhook.

        Expected n8n side:
        - Webhook path matching AUTOCOMPLY_N8N_SLACK_WEBHOOK_PATH
        - Workflow then posts to Slack / logs / etc.
        """
        if not self._is_enabled():
            return  # no-op if not configured

        url = f"{self.base_url}{self.slack_webhook_path}"

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                resp = await client.post(url, json=payload)
            if resp.status_code >= 400:
                logger.warning(
                    "Failed to send slack alert to n8n",
                    extra={"status_code": resp.status_code, "text": resp.text},
                )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Exception while sending slack alert to n8n",
                extra={"error": str(exc)},
            )


_publisher: Optional[EventPublisher] = None


def get_event_publisher() -> EventPublisher:
    """
    Singleton-style accessor so the app can reuse one publisher instance.
    """
    global _publisher
    if _publisher is None:
        settings = get_settings()
        _publisher = EventPublisher(
            base_url=settings.AUTOCOMPLY_N8N_BASE_URL,
            slack_webhook_path=settings.AUTOCOMPLY_N8N_SLACK_WEBHOOK_PATH,
        )
    return _publisher
