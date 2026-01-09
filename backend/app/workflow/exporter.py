"""
Case Export Module

Generates case packets for export as JSON or PDF.

Functions:
- build_case_bundle(case_id) - Gather all case data
- generate_pdf(case_bundle) - Generate PDF packet using reportlab
"""

from datetime import datetime
from typing import Dict, Any, Optional
from io import BytesIO
import hashlib
import json

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.pdfgen import canvas

from .repo import get_case, list_audit_events
from ..submissions.repo import get_submission


def build_case_bundle(case_id: str) -> Optional[Dict[str, Any]]:
    """
    Build complete case bundle for export.
    
    Args:
        case_id: Case UUID
        
    Returns:
        Dict containing:
        - case: CaseRecord
        - submission: SubmissionRecord (if linked)
        - auditTimeline: List of AuditEvents
        - evidence: List of EvidenceItems
        - packetEvidence: List of evidence included in packet
        - metadata: Export metadata
        
        None if case not found
        
    Example:
        >>> bundle = build_case_bundle("550e8400-...")
        >>> print(bundle["case"]["title"])
        >>> print(len(bundle["packetEvidence"]))
    """
    # Get case
    case = get_case(case_id)
    if not case:
        return None
    
    # Get submission if linked
    submission = None
    if case.submissionId:
        submission = get_submission(case.submissionId)
    
    # Get audit timeline (list_audit_events returns tuple of events, total)
    audit_events, _ = list_audit_events(case_id)
    
    # Filter packet evidence
    packet_evidence_ids = set(case.packetEvidenceIds or [])
    packet_evidence = [
        ev for ev in case.evidence
        if ev.id in packet_evidence_ids
    ]
    
    return {
        "case": case.model_dump(),
        "submission": submission.model_dump() if submission else None,
        "auditTimeline": [event.model_dump() for event in audit_events],
        "evidence": [ev.model_dump() for ev in case.evidence],
        "packetEvidence": [ev.model_dump() for ev in packet_evidence],
        "metadata": {
            "exportedAt": datetime.utcnow().isoformat(),
            "exportFormat": "bundle",
            "caseId": case_id,
            "version": "1.0",
        }
    }


def generate_pdf(case_bundle: Dict[str, Any]) -> bytes:
    """
    Generate PDF packet from case bundle.
    
    Args:
        case_bundle: Case bundle from build_case_bundle()
        
    Returns:
        PDF bytes
        
    PDF Structure:
    1. Cover Page - Case metadata
    2. Submission Summary - Form data
    3. Decision Summary - Evaluator output
    4. Packet Evidence - Included evidence items
    5. Audit Timeline - Chronological events
    
    Features:
    - Watermark: Diagonal "DEMO - NOT FOR PRODUCTION" on each page
    - Footer: Demo packet label, timestamp, case ID, signature hash
    - Signature: SHA-256 hash of JSON bundle (first 12 chars)
        
    Example:
        >>> bundle = build_case_bundle("550e8400-...")
        >>> pdf_bytes = generate_pdf(bundle)
        >>> with open("case.pdf", "wb") as f:
        ...     f.write(pdf_bytes)
    """
    buffer = BytesIO()
    
    # Compute signature hash over bundle
    signature_hash = _compute_signature_hash(case_bundle)
    
    # Get case metadata for footer
    case = case_bundle["case"]
    case_id = case["id"]
    export_timestamp = case_bundle.get("metadata", {}).get("exportedAt", datetime.utcnow().isoformat())
    
    # Create document with custom canvas for watermark and footer
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=0.75 * inch,
        bottomMargin=1.0 * inch,  # Extra space for footer
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch
    )
    
    story = []
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1a237e'),
        spaceAfter=30,
        alignment=TA_CENTER
    )
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#1a237e'),
        spaceAfter=12,
        spaceBefore=20
    )
    subheading_style = ParagraphStyle(
        'CustomSubheading',
        parent=styles['Heading3'],
        fontSize=12,
        textColor=colors.HexColor('#424242'),
        spaceAfter=8,
        spaceBefore=12
    )
    normal_style = styles['Normal']
    
    submission = case_bundle.get("submission")
    packet_evidence = case_bundle.get("packetEvidence", [])
    audit_timeline = case_bundle.get("auditTimeline", [])
    
    # ========================================================================
    # 1. Cover Page
    # ========================================================================
    
    story.append(Spacer(1, 1.5 * inch))
    story.append(Paragraph("Case Packet", title_style))
    story.append(Spacer(1, 0.5 * inch))
    
    # Case metadata table
    cover_data = [
        ["Case ID:", case["id"]],
        ["Title:", case["title"]],
        ["Decision Type:", case["decisionType"].upper()],
        ["Status:", case["status"].replace("_", " ").title()],
        ["Assigned To:", case.get("assignedTo") or "Unassigned"],
        ["Created:", _format_datetime(case["createdAt"])],
        ["Updated:", _format_datetime(case["updatedAt"])],
        ["Due Date:", _format_datetime(case.get("dueAt")) if case.get("dueAt") else "Not set"],
    ]
    
    cover_table = Table(cover_data, colWidths=[2 * inch, 4.5 * inch])
    cover_table.setStyle(TableStyle([
        ('FONT', (0, 0), (-1, -1), 'Helvetica', 10),
        ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#424242')),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
        ('ALIGN', (1, 0), (1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(cover_table)
    
    # Summary if available
    if case.get("summary"):
        story.append(Spacer(1, 0.3 * inch))
        story.append(Paragraph("<b>Summary:</b>", normal_style))
        story.append(Spacer(1, 0.1 * inch))
        story.append(Paragraph(case["summary"], normal_style))
    
    story.append(PageBreak())
    
    # ========================================================================
    # 2. Submission Summary (if linked)
    # ========================================================================
    
    if submission:
        story.append(Paragraph("Submission Summary", heading_style))
        story.append(Spacer(1, 0.2 * inch))
        
        # Submission metadata
        sub_meta_data = [
            ["Submission ID:", submission["id"]],
            ["Submitted By:", submission.get("submittedBy") or "Unknown"],
            ["Submitted At:", _format_datetime(submission["createdAt"])],
            ["Account ID:", submission.get("accountId") or "N/A"],
            ["Location ID:", submission.get("locationId") or "N/A"],
        ]
        
        sub_meta_table = Table(sub_meta_data, colWidths=[2 * inch, 4.5 * inch])
        sub_meta_table.setStyle(TableStyle([
            ('FONT', (0, 0), (-1, -1), 'Helvetica', 9),
            ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 9),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(sub_meta_table)
        story.append(Spacer(1, 0.2 * inch))
        
        # Form data (if available)
        if submission.get("formData"):
            story.append(Paragraph("Form Data", subheading_style))
            form_data = submission["formData"]
            
            form_rows = [[k, str(v)] for k, v in form_data.items()]
            if form_rows:
                form_table = Table(form_rows, colWidths=[2 * inch, 4.5 * inch])
                form_table.setStyle(TableStyle([
                    ('FONT', (0, 0), (-1, -1), 'Helvetica', 9),
                    ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 9),
                    ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
                    ('ALIGN', (1, 0), (1, -1), 'LEFT'),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
                    ('LEFTPADDING', (0, 0), (-1, -1), 10),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ]))
                story.append(form_table)
                story.append(Spacer(1, 0.2 * inch))
        
        # ====================================================================
        # 3. Decision Summary (if evaluatorOutput exists)
        # ====================================================================
        
        if submission.get("evaluatorOutput"):
            story.append(Paragraph("Decision Summary", subheading_style))
            evaluator_output = submission["evaluatorOutput"]
            
            decision_rows = [[k, str(v)] for k, v in evaluator_output.items()]
            if decision_rows:
                decision_table = Table(decision_rows, colWidths=[2 * inch, 4.5 * inch])
                decision_table.setStyle(TableStyle([
                    ('FONT', (0, 0), (-1, -1), 'Helvetica', 9),
                    ('FONT', (0, 0), (0, -1), 'Helvetica-Bold', 9),
                    ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
                    ('ALIGN', (1, 0), (1, -1), 'LEFT'),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
                    ('LEFTPADDING', (0, 0), (-1, -1), 10),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ]))
                story.append(decision_table)
        
        story.append(PageBreak())
    
    # ========================================================================
    # 4. Packet Evidence
    # ========================================================================
    
    story.append(Paragraph("Evidence Packet", heading_style))
    story.append(Paragraph(f"Included Items: {len(packet_evidence)}", normal_style))
    story.append(Spacer(1, 0.2 * inch))
    
    if packet_evidence:
        for idx, evidence in enumerate(packet_evidence, 1):
            evidence_items = []
            
            # Evidence header
            evidence_items.append(Paragraph(
                f"<b>Evidence {idx}: {evidence['title']}</b>",
                subheading_style
            ))
            
            # Citation
            if evidence.get("citation"):
                evidence_items.append(Paragraph(
                    f"<b>Citation:</b> {evidence['citation']}",
                    normal_style
                ))
                evidence_items.append(Spacer(1, 0.05 * inch))
            
            # Snippet
            if evidence.get("snippet"):
                evidence_items.append(Paragraph(
                    f"<b>Content:</b>",
                    normal_style
                ))
                # Clean snippet text
                snippet_text = evidence["snippet"].replace("\n", "<br/>")
                evidence_items.append(Paragraph(snippet_text, normal_style))
                evidence_items.append(Spacer(1, 0.05 * inch))
            
            # Tags
            if evidence.get("tags"):
                tags_str = ", ".join(evidence["tags"])
                evidence_items.append(Paragraph(
                    f"<b>Tags:</b> {tags_str}",
                    normal_style
                ))
                evidence_items.append(Spacer(1, 0.05 * inch))
            
            # Source ID
            if evidence.get("sourceId"):
                evidence_items.append(Paragraph(
                    f"<b>Source:</b> {evidence['sourceId']}",
                    normal_style
                ))
            
            # Keep evidence together
            story.append(KeepTogether(evidence_items))
            story.append(Spacer(1, 0.2 * inch))
    else:
        story.append(Paragraph("<i>No evidence items included in packet.</i>", normal_style))
    
    story.append(PageBreak())
    
    # ========================================================================
    # 5. Audit Timeline
    # ========================================================================
    
    story.append(Paragraph("Audit Timeline", heading_style))
    story.append(Paragraph(f"Total Events: {len(audit_timeline)}", normal_style))
    story.append(Spacer(1, 0.2 * inch))
    
    if audit_timeline:
        # Sort chronologically (oldest first for timeline)
        sorted_events = sorted(audit_timeline, key=lambda e: e["createdAt"])
        
        # Create timeline table
        timeline_data = [["Time", "Event", "Actor", "Message"]]
        
        for event in sorted_events:
            timeline_data.append([
                _format_datetime(event["createdAt"], include_time=True),
                event["eventType"].replace("_", " ").title(),
                event.get("actor") or "System",
                event.get("message") or "",
            ])
        
        timeline_table = Table(
            timeline_data,
            colWidths=[1.3 * inch, 1.5 * inch, 1.2 * inch, 2.5 * inch]
        )
        timeline_table.setStyle(TableStyle([
            # Header
            ('FONT', (0, 0), (-1, 0), 'Helvetica-Bold', 9),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a237e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            # Body
            ('FONT', (0, 1), (-1, -1), 'Helvetica', 8),
            ('ALIGN', (0, 1), (2, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(timeline_table)
    else:
        story.append(Paragraph("<i>No audit events recorded.</i>", normal_style))
    
    # Build PDF with custom canvas (adds watermark and footer to each page)
    doc.build(
        story,
        onFirstPage=lambda c, d: None,  # Watermark/footer handled by canvas
        onLaterPages=lambda c, d: None,
        canvasmaker=lambda *args, **kwargs: NumberedCanvas(
            *args,
            case_id=case_id,
            export_timestamp=export_timestamp,
            signature_hash=signature_hash,
            **kwargs
        )
    )
    
    # Return bytes
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def _format_datetime(dt_str, include_time: bool = False) -> str:
    """Format ISO datetime string for display."""
    if not dt_str:
        return "N/A"
    
    try:
        # Handle both datetime objects and strings
        if isinstance(dt_str, datetime):
            dt = dt_str
        else:
            dt = datetime.fromisoformat(dt_str)
        
        if include_time:
            return dt.strftime("%Y-%m-%d %H:%M:%S UTC")
        return dt.strftime("%Y-%m-%d")
    except (ValueError, AttributeError, TypeError):
        return str(dt_str)


def _compute_signature_hash(case_bundle: Dict[str, Any]) -> str:
    """
    Compute SHA-256 signature hash over case bundle JSON.
    
    Args:
        case_bundle: Complete case bundle dict
        
    Returns:
        First 12 characters of hex digest (e.g., "a3f5e9c1b2d4")
    """
    # Custom JSON encoder that handles datetime objects
    class DateTimeEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            return super().default(obj)
    
    # Serialize to JSON with stable ordering and datetime handling
    json_str = json.dumps(case_bundle, sort_keys=True, separators=(',', ':'), cls=DateTimeEncoder)
    
    # Compute SHA-256 hash
    hash_obj = hashlib.sha256(json_str.encode('utf-8'))
    hex_digest = hash_obj.hexdigest()
    
    # Return first 12 characters
    return hex_digest[:12]


class NumberedCanvas(canvas.Canvas):
    """
    Custom canvas that adds watermark and footer to each page.
    
    Footer includes:
    - "AutoComply AI Demo Packet"
    - Generated timestamp (UTC)
    - Case ID
    - Signature hash
    
    Watermark: Diagonal "DEMO - NOT FOR PRODUCTION" text
    """
    
    def __init__(self, *args, **kwargs):
        # Extract custom params
        self.case_id = kwargs.pop('case_id', 'N/A')
        self.export_timestamp = kwargs.pop('export_timestamp', datetime.utcnow().isoformat())
        self.signature_hash = kwargs.pop('signature_hash', 'N/A')
        
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []
    
    def showPage(self):
        """Override to add watermark and footer before showing page."""
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()
    
    def save(self):
        """Add watermark and footer to all pages before saving."""
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._add_watermark()
            self._add_footer(self._pageNumber, num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)
    
    def _add_watermark(self):
        """Add diagonal watermark to page."""
        self.saveState()
        
        # Set watermark properties (light gray, large, diagonal)
        self.setFont('Helvetica-Bold', 60)
        self.setFillColor(colors.Color(0.9, 0.9, 0.9, alpha=0.3))  # Light gray with transparency
        
        # Calculate position for diagonal text
        page_width, page_height = letter
        
        # Rotate and position watermark diagonally
        self.translate(page_width / 2, page_height / 2)
        self.rotate(45)
        
        # Draw watermark text centered
        text = "DEMO - NOT FOR PRODUCTION"
        text_width = self.stringWidth(text, 'Helvetica-Bold', 60)
        self.drawString(-text_width / 2, 0, text)
        
        self.restoreState()
    
    def _add_footer(self, page_num: int, total_pages: int):
        """Add footer to page."""
        self.saveState()
        
        page_width, page_height = letter
        footer_y = 0.5 * inch
        
        # Footer text
        self.setFont('Helvetica', 8)
        self.setFillColor(colors.HexColor('#666666'))
        
        # Left: Demo packet label
        self.drawString(0.75 * inch, footer_y, "AutoComply AI Demo Packet")
        
        # Center: Timestamp
        timestamp_text = f"Generated: {_format_datetime(self.export_timestamp, include_time=True)}"
        timestamp_width = self.stringWidth(timestamp_text, 'Helvetica', 8)
        self.drawString((page_width - timestamp_width) / 2, footer_y, timestamp_text)
        
        # Right: Page number
        page_text = f"Page {page_num} of {total_pages}"
        page_width_text = self.stringWidth(page_text, 'Helvetica', 8)
        self.drawString(page_width - 0.75 * inch - page_width_text, footer_y, page_text)
        
        # Second line: Case ID and Signature
        footer_y2 = footer_y - 12
        
        # Left: Case ID
        case_id_text = f"Case ID: {self.case_id}"
        self.drawString(0.75 * inch, footer_y2, case_id_text)
        
        # Right: Signature hash
        signature_text = f"Signature: {self.signature_hash}"
        signature_width = self.stringWidth(signature_text, 'Helvetica', 8)
        self.drawString(page_width - 0.75 * inch - signature_width, footer_y2, signature_text)
        
        self.restoreState()

