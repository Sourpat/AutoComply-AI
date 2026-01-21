"""
Export Scheduler Service

Background thread that polls for due exports and executes them.
"""

import threading
import time
import os
from pathlib import Path
from typing import Dict, Any
from datetime import datetime, timezone
import json

from .scheduled_exports_repo import get_due_exports, mark_export_run
from .exporter import build_case_bundle, generate_pdf
from .repo import get_case
from app.analytics.views_repo import get_view, list_views


# Global scheduler state
_scheduler_thread: threading.Thread = None
_stop_event = threading.Event()

# Export storage directory
EXPORTS_DIR = Path(__file__).parent.parent / "data" / "exports"


def ensure_exports_dir():
    """Create exports directory if it doesn't exist."""
    EXPORTS_DIR.mkdir(parents=True, exist_ok=True)


def run_export_job(export: Dict[str, Any]) -> None:
    """
    Execute a single export job.
    
    Args:
        export: Export record from database
    """
    print(f"[Scheduler] Running export: {export['name']} (ID: {export['id']})")
    
    ensure_exports_dir()
    
    mode = export["mode"]
    target_id = export["target_id"]
    export_type = export["export_type"]
    
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    
    try:
        if mode == "case":
            run_case_export(export, target_id, export_type, timestamp)
        elif mode == "saved_view":
            run_view_export(export, target_id, export_type, timestamp)
        else:
            print(f"[Scheduler] Unknown mode: {mode}")
            return
        
        print(f"[Scheduler] Export completed: {export['name']}")
        
    except Exception as e:
        print(f"[Scheduler] Export failed: {export['name']} - {e}")
        # Continue even if export fails


def run_case_export(
    export: Dict[str, Any],
    case_id: str,
    export_type: str,
    timestamp: str
) -> None:
    """
    Export a case as PDF and/or JSON.
    
    Args:
        export: Export record
        case_id: Case ID
        export_type: "pdf", "json", or "both"
        timestamp: Timestamp string for filename
    """
    # Get case data
    case = get_case(case_id)
    if not case:
        print(f"[Scheduler] Case not found: {case_id}")
        return
    
    base_filename = f"case_{case_id}_{timestamp}"
    
    # Generate JSON bundle
    if export_type in ("json", "both"):
        try:
            bundle = build_case_bundle(case_id)
            json_path = EXPORTS_DIR / f"{base_filename}.json"
            
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(bundle, f, indent=2, ensure_ascii=False)
            
            print(f"[Scheduler] JSON saved: {json_path}")
        except Exception as e:
            print(f"[Scheduler] JSON export failed: {e}")
    
    # Generate PDF
    if export_type in ("pdf", "both"):
        try:
            pdf_bytes = generate_pdf(case_id)
            pdf_path = EXPORTS_DIR / f"{base_filename}.pdf"
            
            with open(pdf_path, "wb") as f:
                f.write(pdf_bytes)
            
            print(f"[Scheduler] PDF saved: {pdf_path}")
        except Exception as e:
            print(f"[Scheduler] PDF export failed: {e}")


def run_view_export(
    export: Dict[str, Any],
    view_id: str,
    export_type: str,
    timestamp: str
) -> None:
    """
    Export a saved view as JSON summary.
    
    Args:
        export: Export record
        view_id: View ID
        export_type: "pdf", "json", or "both"
        timestamp: Timestamp string for filename
    """
    # Get view data
    view = get_view(view_id)
    if not view:
        print(f"[Scheduler] View not found: {view_id}")
        return
    
    base_filename = f"view_{view_id}_{timestamp}"
    
    # Generate JSON summary
    if export_type in ("json", "both"):
        try:
            # Build view summary
            summary = {
                "view_id": view_id,
                "view_name": view["name"],
                "scope": view["scope"],
                "view_json": view["view_json"],
                "exported_at": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                "metadata": {
                    "created_at": view["created_at"],
                    "owner": view["owner"],
                    "is_shared": bool(view["is_shared"]),
                }
            }
            
            json_path = EXPORTS_DIR / f"{base_filename}.json"
            
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(summary, f, indent=2, ensure_ascii=False)
            
            print(f"[Scheduler] View JSON saved: {json_path}")
        except Exception as e:
            print(f"[Scheduler] View JSON export failed: {e}")
    
    # PDF export for views not yet implemented
    if export_type in ("pdf", "both"):
        print(f"[Scheduler] PDF export for views not yet implemented")


def scheduler_loop():
    """Main scheduler loop - runs every 60 seconds."""
    print("[Scheduler] Started")
    
    while not _stop_event.is_set():
        try:
            # Get due exports
            due_exports = get_due_exports()
            
            if due_exports:
                print(f"[Scheduler] Found {len(due_exports)} due exports")
                
                for export in due_exports:
                    if _stop_event.is_set():
                        break
                    
                    # Run the export
                    run_export_job(export)
                    
                    # Mark as run and calculate next run
                    mark_export_run(export["id"])
            
        except Exception as e:
            print(f"[Scheduler] Error in scheduler loop: {e}")
        
        # Wait 60 seconds before next check
        _stop_event.wait(60)
    
    print("[Scheduler] Stopped")


def start_scheduler():
    """Start the background scheduler thread."""
    global _scheduler_thread
    
    if _scheduler_thread and _scheduler_thread.is_alive():
        print("[Scheduler] Already running")
        return
    
    _stop_event.clear()
    _scheduler_thread = threading.Thread(target=scheduler_loop, daemon=True)
    _scheduler_thread.start()
    print("[Scheduler] Thread started")


def stop_scheduler():
    """Stop the scheduler thread."""
    global _scheduler_thread
    
    if not _scheduler_thread or not _scheduler_thread.is_alive():
        print("[Scheduler] Not running")
        return
    
    print("[Scheduler] Stopping...")
    _stop_event.set()
    _scheduler_thread.join(timeout=5)
    _scheduler_thread = None
    print("[Scheduler] Stopped")
