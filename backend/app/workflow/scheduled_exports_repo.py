"""
Scheduled Exports Repository

Manages recurring export jobs stored in SQLite.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
import uuid
from src.core.db import execute_sql, execute_insert, execute_update, execute_delete


def generate_export_id() -> str:
    """Generate unique export ID."""
    return f"export_{uuid.uuid4().hex[:12]}"


def calculate_next_run(
    schedule: str, 
    hour: int, 
    minute: int, 
    from_time: Optional[datetime] = None
) -> str:
    """
    Calculate next run time based on schedule.
    
    Args:
        schedule: "DAILY" or "WEEKLY"
        hour: Hour of day (0-23)
        minute: Minute (0-59)
        from_time: Calculate from this time (default: now)
        
    Returns:
        ISO formatted datetime string
    """
    now = from_time or datetime.now(timezone.utc)
    
    # Create target time today
    target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    
    if schedule == "DAILY":
        # If target time has passed today, schedule for tomorrow
        if target <= now:
            target += timedelta(days=1)
    elif schedule == "WEEKLY":
        # Schedule for same time next week
        if target <= now:
            target += timedelta(weeks=1)
        else:
            # If we haven't reached today's target, use it
            pass
    else:
        # Default to 24 hours from now
        target = now + timedelta(days=1)
    
    return target.isoformat()


def create_scheduled_export(
    name: str,
    schedule: str,
    hour: int,
    minute: int,
    mode: str,
    target_id: str,
    export_type: str,
    owner: Optional[str] = None,
    timezone: str = "UTC",
    is_enabled: bool = True,
) -> Dict[str, Any]:
    """
    Create a new scheduled export.
    
    Args:
        name: Display name
        schedule: "DAILY" or "WEEKLY"
        hour: Hour (0-23)
        minute: Minute (0-59)
        mode: "case" or "saved_view"
        target_id: Case ID or view ID
        export_type: "pdf", "json", or "both"
        owner: Owner username
        timezone: Timezone (default UTC)
        is_enabled: Whether enabled
        
    Returns:
        Created export record
    """
    export_id = generate_export_id()
    now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    next_run = calculate_next_run(schedule, hour, minute)
    
    query = """
        INSERT INTO scheduled_exports (
            id, created_at, updated_at, name, schedule, hour, minute,
            timezone, mode, target_id, export_type, is_enabled,
            last_run_at, next_run_at, owner
        )
        VALUES (
            :id, :created_at, :updated_at, :name, :schedule, :hour, :minute,
            :timezone, :mode, :target_id, :export_type, :is_enabled,
            NULL, :next_run_at, :owner
        )
    """
    
    params = {
        "id": export_id,
        "created_at": now,
        "updated_at": now,
        "name": name,
        "schedule": schedule,
        "hour": hour,
        "minute": minute,
        "timezone": timezone,
        "mode": mode,
        "target_id": target_id,
        "export_type": export_type,
        "is_enabled": 1 if is_enabled else 0,
        "next_run_at": next_run,
        "owner": owner,
    }
    
    execute_insert(query, params)
    
    return get_scheduled_export(export_id)


def list_scheduled_exports(owner: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List all scheduled exports.
    
    Args:
        owner: Filter by owner (optional)
        
    Returns:
        List of export records
    """
    query = """
        SELECT 
            id, created_at, updated_at, name, schedule, hour, minute,
            timezone, mode, target_id, export_type, is_enabled,
            last_run_at, next_run_at, owner
        FROM scheduled_exports
    """
    
    params = {}
    if owner:
        query += " WHERE owner = :owner"
        params["owner"] = owner
    
    query += " ORDER BY next_run_at ASC"
    
    results = execute_sql(query, params)
    return [dict(row) for row in results]


def get_scheduled_export(export_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a scheduled export by ID.
    
    Args:
        export_id: Export ID
        
    Returns:
        Export record or None
    """
    query = """
        SELECT 
            id, created_at, updated_at, name, schedule, hour, minute,
            timezone, mode, target_id, export_type, is_enabled,
            last_run_at, next_run_at, owner
        FROM scheduled_exports
        WHERE id = :export_id
    """
    
    results = execute_sql(query, {"export_id": export_id})
    rows = list(results)
    
    if not rows:
        return None
    
    return dict(rows[0])


def update_scheduled_export(
    export_id: str,
    name: Optional[str] = None,
    schedule: Optional[str] = None,
    hour: Optional[int] = None,
    minute: Optional[int] = None,
    timezone: Optional[str] = None,
    export_type: Optional[str] = None,
    is_enabled: Optional[bool] = None,
) -> Optional[Dict[str, Any]]:
    """
    Update a scheduled export.
    
    Args:
        export_id: Export ID
        name: New name
        schedule: New schedule
        hour: New hour
        minute: New minute
        timezone: New timezone
        export_type: New export type
        is_enabled: New enabled status
        
    Returns:
        Updated export record or None
    """
    # Get current record
    current = get_scheduled_export(export_id)
    if not current:
        return None
    
    # Build update fields
    updates = []
    params = {"export_id": export_id, "updated_at": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')}
    
    if name is not None:
        updates.append("name = :name")
        params["name"] = name
    
    if schedule is not None:
        updates.append("schedule = :schedule")
        params["schedule"] = schedule
    
    if hour is not None:
        updates.append("hour = :hour")
        params["hour"] = hour
    
    if minute is not None:
        updates.append("minute = :minute")
        params["minute"] = minute
    
    if timezone is not None:
        updates.append("timezone = :timezone")
        params["timezone"] = timezone
    
    if export_type is not None:
        updates.append("export_type = :export_type")
        params["export_type"] = export_type
    
    if is_enabled is not None:
        updates.append("is_enabled = :is_enabled")
        params["is_enabled"] = 1 if is_enabled else 0
    
    # Recalculate next_run if schedule changed
    if schedule is not None or hour is not None or minute is not None:
        final_schedule = schedule or current["schedule"]
        final_hour = hour if hour is not None else current["hour"]
        final_minute = minute if minute is not None else current["minute"]
        
        next_run = calculate_next_run(final_schedule, final_hour, final_minute)
        updates.append("next_run_at = :next_run_at")
        params["next_run_at"] = next_run
    
    if not updates:
        return current
    
    # Always update updated_at
    updates.append("updated_at = :updated_at")
    
    query = f"""
        UPDATE scheduled_exports
        SET {', '.join(updates)}
        WHERE id = :export_id
    """
    
    execute_update(query, params)
    
    return get_scheduled_export(export_id)


def delete_scheduled_export(export_id: str) -> bool:
    """
    Delete a scheduled export.
    
    Args:
        export_id: Export ID
        
    Returns:
        True if deleted
    """
    query = "DELETE FROM scheduled_exports WHERE id = :export_id"
    execute_delete(query, {"export_id": export_id})
    return True


def mark_export_run(export_id: str) -> None:
    """
    Mark an export as run and calculate next run time.
    
    Args:
        export_id: Export ID
    """
    export = get_scheduled_export(export_id)
    if not export:
        return
    
    now = datetime.now(timezone.utc)
    next_run = calculate_next_run(
        export["schedule"],
        export["hour"],
        export["minute"],
        from_time=now
    )
    
    query = """
        UPDATE scheduled_exports
        SET last_run_at = :last_run_at,
            next_run_at = :next_run_at,
            updated_at = :updated_at
        WHERE id = :export_id
    """
    
    params = {
        "export_id": export_id,
        "last_run_at": now.isoformat(),
        "next_run_at": next_run,
        "updated_at": now.isoformat(),
    }
    
    execute_update(query, params)


def get_due_exports() -> List[Dict[str, Any]]:
    """
    Get exports that are due to run.
    
    Returns:
        List of due export records
    """
    now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    
    query = """
        SELECT 
            id, created_at, updated_at, name, schedule, hour, minute,
            timezone, mode, target_id, export_type, is_enabled,
            last_run_at, next_run_at, owner
        FROM scheduled_exports
        WHERE is_enabled = 1
          AND next_run_at IS NOT NULL
          AND next_run_at <= :now
        ORDER BY next_run_at ASC
    """
    
    results = execute_sql(query, {"now": now})
    return [dict(row) for row in results]
