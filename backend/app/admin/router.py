"""
Admin Operations Router

⚠️ WARNING: DANGEROUS OPERATIONS ⚠️

This module contains DESTRUCTIVE admin operations that can permanently delete data.
ALL endpoints in this router are ADMIN-ONLY and require X-AutoComply-Role: admin.

RESET OPERATION:
- Deletes ALL data from database
- Deletes ALL export files
- CANNOT BE UNDONE
- Use ONLY in development/testing

DO NOT expose this router in production without additional safeguards.
"""

from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Request, Header
from pathlib import Path
import shutil

from app.core.authz import require_admin
from src.core.db import execute_sql


router = APIRouter(prefix="/admin", tags=["admin"])


# ============================================================================
# Reset Operations - ⚠️ DANGEROUS ⚠️
# ============================================================================

@router.get("/reset/preview")
def preview_reset(request: Request):
    """
    Preview what would be deleted by reset operation.
    
    ⚠️ ADMIN ONLY
    
    Returns row counts for all tables and file counts.
    Does NOT delete anything - safe to call.
    
    Authorization:
        Requires X-AutoComply-Role: admin
    
    Returns:
        {
            "tables": {
                "cases": 15,
                "evidence_items": 45,
                "audit_events": 120,
                ...
            },
            "files": {
                "exports": 8
            },
            "warning": "POST /admin/reset will DELETE all this data permanently"
        }
    """
    require_admin(request)
    
    # Count rows in each table
    tables = [
        "cases",
        "evidence_items",
        "case_packet",
        "audit_events",
        "submissions",
    ]
    
    # Optional tables (may not exist)
    optional_tables = [
        "saved_views",
        "scheduled_exports",
        "scheduled_export_runs",
    ]
    
    table_counts = {}
    
    # Count required tables
    for table in tables:
        try:
            result = execute_sql(f"SELECT COUNT(*) as count FROM {table}", {})
            table_counts[table] = result[0]["count"] if result else 0
        except Exception as e:
            table_counts[table] = f"Error: {str(e)}"
    
    # Count optional tables (don't fail if they don't exist)
    for table in optional_tables:
        try:
            result = execute_sql(f"SELECT COUNT(*) as count FROM {table}", {})
            table_counts[table] = result[0]["count"] if result else 0
        except Exception:
            # Table doesn't exist - skip
            pass
    
    # Count export files
    exports_dir = Path("app/data/exports")
    export_file_count = 0
    if exports_dir.exists():
        export_file_count = len(list(exports_dir.glob("*")))
    
    return {
        "tables": table_counts,
        "files": {
            "exports": export_file_count,
            "exports_path": str(exports_dir.absolute()) if exports_dir.exists() else "Not found"
        },
        "warning": "⚠️ POST /admin/reset will DELETE all this data permanently and CANNOT BE UNDONE",
        "confirmation_required": "X-AutoComply-Reset-Confirm: RESET"
    }


@router.post("/reset")
def reset_all_data(
    request: Request,
    x_autocomply_reset_confirm: str = Header(None, alias="X-AutoComply-Reset-Confirm")
):
    """
    ⚠️ DANGER: DELETE ALL DATA ⚠️
    
    Permanently deletes:
    - ALL rows from all database tables
    - ALL files in exports directory
    
    This operation CANNOT BE UNDONE.
    
    Authorization:
        Requires X-AutoComply-Role: admin
    
    Confirmation:
        Requires header: X-AutoComply-Reset-Confirm: RESET
    
    Safety:
        - Preview with GET /admin/reset/preview first
        - Backup database before running
        - Use ONLY in development/testing
    
    Returns:
        {
            "ok": true,
            "deleted": {
                "tables": {...},
                "files": {...}
            },
            "warning": "All data has been permanently deleted"
        }
    
    Example:
        curl -X POST http://localhost:8001/admin/reset \\
          -H "X-AutoComply-Role: admin" \\
          -H "X-AutoComply-Reset-Confirm: RESET"
    """
    # ========================================================================
    # ⚠️ SAFETY CHECKS ⚠️
    # ========================================================================
    
    # Check 1: Admin role required
    require_admin(request)
    
    # Check 2: Confirmation header required
    if x_autocomply_reset_confirm != "RESET":
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Missing or invalid confirmation header",
                "required": "X-AutoComply-Reset-Confirm: RESET",
                "received": x_autocomply_reset_confirm or "(none)",
                "hint": "This is a destructive operation. Include the exact header to confirm."
            }
        )
    
    # ========================================================================
    # ⚠️ DESTRUCTIVE OPERATIONS BEGIN ⚠️
    # ========================================================================
    
    deleted_counts = {}
    
    # Tables to delete (order matters for foreign key constraints)
    # Delete child tables first, then parent tables
    tables_to_delete = [
        # Child tables first
        "case_packet",
        "evidence_items",
        "audit_events",
        
        # Parent tables
        "cases",
        "submissions",
        
        # Optional tables (may not exist)
        "scheduled_export_runs",
        "scheduled_exports",
        "saved_views",
    ]
    
    # Delete rows from each table
    for table in tables_to_delete:
        try:
            # Get count before delete
            count_result = execute_sql(f"SELECT COUNT(*) as count FROM {table}", {})
            count = count_result[0]["count"] if count_result else 0
            
            # Delete all rows
            execute_sql(f"DELETE FROM {table}", {})
            
            # Reset auto-increment (if applicable)
            try:
                execute_sql(f"DELETE FROM sqlite_sequence WHERE name = :table", {"table": table})
            except Exception:
                # sqlite_sequence might not exist or table might not have auto-increment
                pass
            
            deleted_counts[table] = count
            
        except Exception as e:
            # Table might not exist (optional tables)
            if "no such table" not in str(e).lower():
                # Real error - include it
                deleted_counts[table] = f"Error: {str(e)}"
    
    # Delete export files
    exports_dir = Path("app/data/exports")
    deleted_files = 0
    
    if exports_dir.exists():
        # Count files before deletion
        files = list(exports_dir.glob("*"))
        deleted_files = len(files)
        
        # Delete all files in exports directory
        for file_path in files:
            try:
                if file_path.is_file():
                    file_path.unlink()
                elif file_path.is_dir():
                    shutil.rmtree(file_path)
            except Exception as e:
                # Log error but continue
                pass
    
    # ========================================================================
    # ⚠️ DESTRUCTIVE OPERATIONS COMPLETE ⚠️
    # ========================================================================
    
    return {
        "ok": True,
        "deleted": {
            "tables": deleted_counts,
            "files": {
                "exports": deleted_files,
                "exports_path": str(exports_dir.absolute()) if exports_dir.exists() else "Not found"
            }
        },
        "warning": "⚠️ All data has been permanently deleted and CANNOT BE RECOVERED",
        "timestamp": execute_sql("SELECT datetime('now') as timestamp", {})[0]["timestamp"]
    }
