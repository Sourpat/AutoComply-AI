"""
Saved Views Repository

Manages saved analytics and console views in SQLite.
Provides CRUD operations for filter presets and dashboard layouts.
"""

import uuid
import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from src.core.db import execute_sql, execute_insert, execute_update, execute_delete


def create_view(
    name: str,
    scope: str,
    view_json: Dict[str, Any],
    owner: Optional[str] = None,
    is_shared: bool = False,
) -> str:
    """
    Create a new saved view.
    
    Args:
        name: Display name for the view
        scope: Scope of the view ("analytics" or "console")
        view_json: JSON object containing filters, columns, layout
        owner: Actor/username who owns this view (optional)
        is_shared: Whether view is shared with all users
    
    Returns:
        Created view ID
    """
    view_id = f"view_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    
    execute_insert(
        """
        INSERT INTO saved_views (
            id, created_at, updated_at, name, scope, view_json, owner, is_shared
        ) VALUES (
            :id, :created_at, :updated_at, :name, :scope, :view_json, :owner, :is_shared
        )
        """,
        {
            "id": view_id,
            "created_at": now,
            "updated_at": now,
            "name": name,
            "scope": scope,
            "view_json": json.dumps(view_json),
            "owner": owner,
            "is_shared": 1 if is_shared else 0,
        }
    )
    
    return view_id


def list_views(scope: Optional[str] = None, owner: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List saved views with optional filtering.
    
    Args:
        scope: Filter by scope ("analytics" or "console")
        owner: Filter by owner username
    
    Returns:
        List of saved views with parsed JSON
    """
    conditions = []
    params = {}
    
    if scope:
        conditions.append("scope = :scope")
        params["scope"] = scope
    
    if owner:
        # Return views owned by this user OR shared views
        conditions.append("(owner = :owner OR is_shared = 1)")
        params["owner"] = owner
    
    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    
    rows = execute_sql(
        f"""
        SELECT id, created_at, updated_at, name, scope, view_json, owner, is_shared
        FROM saved_views
        {where_clause}
        ORDER BY created_at DESC
        """,
        params if params else None
    )
    
    # Parse view_json for each row
    result = []
    for row in rows:
        view = dict(row)
        try:
            view["view_json"] = json.loads(view["view_json"])
        except (json.JSONDecodeError, TypeError):
            view["view_json"] = {}
        
        view["is_shared"] = bool(view["is_shared"])
        result.append(view)
    
    return result


def get_view(view_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a saved view by ID.
    
    Args:
        view_id: View ID
    
    Returns:
        View data with parsed JSON, or None if not found
    """
    rows = execute_sql(
        """
        SELECT id, created_at, updated_at, name, scope, view_json, owner, is_shared
        FROM saved_views
        WHERE id = :id
        """,
        {"id": view_id}
    )
    
    if not rows:
        return None
    
    view = dict(rows[0])
    try:
        view["view_json"] = json.loads(view["view_json"])
    except (json.JSONDecodeError, TypeError):
        view["view_json"] = {}
    
    view["is_shared"] = bool(view["is_shared"])
    return view


def update_view(view_id: str, patch: Dict[str, Any]) -> bool:
    """
    Update a saved view.
    
    Args:
        view_id: View ID
        patch: Fields to update (name, view_json, is_shared)
    
    Returns:
        True if updated, False if not found
    """
    # Check if view exists
    existing = get_view(view_id)
    if not existing:
        return False
    
    # Build update fields
    updates = ["updated_at = :updated_at"]
    params = {
        "id": view_id,
        "updated_at": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
    }
    
    if "name" in patch:
        updates.append("name = :name")
        params["name"] = patch["name"]
    
    if "view_json" in patch:
        updates.append("view_json = :view_json")
        params["view_json"] = json.dumps(patch["view_json"])
    
    if "is_shared" in patch:
        updates.append("is_shared = :is_shared")
        params["is_shared"] = 1 if patch["is_shared"] else 0
    
    execute_update(
        f"""
        UPDATE saved_views
        SET {', '.join(updates)}
        WHERE id = :id
        """,
        params
    )
    
    return True


def delete_view(view_id: str) -> bool:
    """
    Delete a saved view.
    
    Args:
        view_id: View ID
    
    Returns:
        True if deleted, False if not found
    """
    # Check if view exists
    existing = get_view(view_id)
    if not existing:
        return False
    
    execute_delete(
        "DELETE FROM saved_views WHERE id = :id",
        {"id": view_id}
    )
    
    return True
