from __future__ import annotations

import json
from io import BytesIO
from typing import Any, Dict, List

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


def _sort_citations(citations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(
        citations,
        key=lambda c: (
            str(c.get("source_title") or c.get("doc_id") or ""),
            str(c.get("citation") or ""),
            str(c.get("chunk_id") or ""),
        ),
    )


def _paragraph(text: str, style) -> Paragraph:
    return Paragraph(text.replace("\n", "<br/>") or "-", style)


def render_decision_packet_pdf(packet: Dict[str, Any]) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title=f"Decision Packet {packet.get('case', {}).get('case_id', '')}",
    )
    styles = getSampleStyleSheet()
    heading = styles["Heading2"]
    body = styles["BodyText"]
    mono = styles["Code"] if "Code" in styles else styles["BodyText"]
    mono.fontName = "Courier"

    story = []
    story.append(Paragraph("Decision Packet", styles["Heading1"]))
    story.append(Spacer(1, 0.15 * inch))

    case = packet.get("case", {})
    verifier = packet.get("verifier", {})

    story.append(Paragraph("Case", heading))
    story.append(_paragraph(json.dumps(case, indent=2), mono))
    story.append(Spacer(1, 0.15 * inch))

    story.append(Paragraph("Verifier", heading))
    story.append(_paragraph(json.dumps(verifier, indent=2), mono))
    story.append(Spacer(1, 0.15 * inch))

    story.append(Paragraph("Actions", heading))
    actions = packet.get("actions", [])
    story.append(_paragraph(json.dumps(actions, indent=2), mono))
    story.append(Spacer(1, 0.15 * inch))

    story.append(Paragraph("Timeline", heading))
    timeline = packet.get("timeline", [])
    story.append(_paragraph(json.dumps(timeline, indent=2), mono))
    story.append(Spacer(1, 0.15 * inch))

    finalization = packet.get("finalization")
    if finalization:
        title = "Finalization (FINAL)" if finalization.get("is_final") else "Finalization"
        story.append(Paragraph(title, heading))
        story.append(_paragraph(json.dumps(finalization, indent=2), mono))
        story.append(Spacer(1, 0.15 * inch))

    story.append(Paragraph("Evidence", heading))
    explain = packet.get("explain") or {}
    citations = _sort_citations(explain.get("citations", []))
    story.append(_paragraph(json.dumps(citations, indent=2), mono))

    doc.build(story)
    return buffer.getvalue()
