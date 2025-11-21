from src.utils.events import EventPublisher, EventPublisherConfig


def test_event_publisher_builds_payload():
    config = EventPublisherConfig(n8n_base_url=None, slack_webhook_path=None)
    publisher = EventPublisher(config=config)

    payload = publisher.build_license_event(
        success=True,
        license_id="CA-12345",
        state="CA",
        allow_checkout=True,
        reason="License active and valid.",
        extra={"source": "unit-test"},
    )

    assert payload["event"] == "license_validation"
    assert payload["success"] is True
    assert payload["license_id"] == "CA-12345"
    assert payload["state"] == "CA"
    assert payload["allow_checkout"] is True
    assert payload["reason"] == "License active and valid."
    assert payload["extra"]["source"] == "unit-test"


def test_event_publisher_noop_when_not_configured():
    # Config with no URLs should cause NO-OP behavior.
    config = EventPublisherConfig(n8n_base_url=None, slack_webhook_path=None)
    publisher = EventPublisher(config=config)

    result = publisher.publish_license_event(
        success=True,
        license_id="CA-12345",
        state="CA",
        allow_checkout=True,
        reason="License active and valid.",
    )

    # In NO-OP mode, publish returns False but does not raise.
    assert result is False


def test_event_publisher_logs_when_configured():
    # Even when configured, current implementation does not send HTTP requests;
    # it only logs and returns True. This keeps tests and CI safe.
    config = EventPublisherConfig(
        n8n_base_url="https://example-n8n.test",
        slack_webhook_path="/webhook/slack-license-events",
    )
    publisher = EventPublisher(config=config)

    result = publisher.publish_license_event(
        success=False,
        license_id="CA-EXPIRED",
        state="CA",
        allow_checkout=False,
        reason="License is expired.",
    )

    assert result is True
