/**
 * Saved Views API Client
 * 
 * HTTP client functions for /api/analytics/views endpoints.
 * Handles saved analytics and console filter presets.
 */

import { API_BASE } from '../lib/api';
import { getAuthHeaders, getJsonHeaders } from '../lib/authHeaders';
import { cachedFetchJson } from './apiCache';

const VIEWS_BASE = `${API_BASE}/api/analytics/views`;

// ============================================================================
// Types
// ============================================================================

export interface SavedView {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  scope: 'analytics' | 'console';
  view_json: Record<string, any>;
  owner: string | null;
  is_shared: boolean;
}

export interface CreateViewPayload {
  name: string;
  scope: 'analytics' | 'console';
  view_json: Record<string, any>;
  is_shared?: boolean;
}

export interface UpdateViewPayload {
  name?: string;
  view_json?: Record<string, any>;
  is_shared?: boolean;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * List saved views
 * 
 * @param scope - Optional filter by scope (analytics or console)
 * @returns List of saved views
 */
export async function listViews(scope?: string): Promise<SavedView[]> {
  const params = new URLSearchParams();
  if (scope) {
    params.set('scope', scope);
  }
  
  const url = params.toString() 
    ? `${VIEWS_BASE}?${params}` 
    : VIEWS_BASE;
  
  return cachedFetchJson<SavedView[]>(url, {
    headers: getAuthHeaders(),
  });
}

/**
 * Create a new saved view
 * 
 * @param payload - View data (name, scope, view_json, is_shared)
 * @returns Created view
 */
export async function createView(payload: CreateViewPayload): Promise<SavedView> {
  const response = await fetch(VIEWS_BASE, {
    method: 'POST',
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create view: ${response.status} - ${error}`);
  }
  
  return response.json();
}

/**
 * Get a saved view by ID
 * 
 * @param viewId - View ID
 * @returns Saved view
 */
export async function getView(viewId: string): Promise<SavedView> {
  return cachedFetchJson<SavedView>(`${VIEWS_BASE}/${viewId}`, {
    headers: getAuthHeaders(),
  });
}

/**
 * Update a saved view
 * 
 * @param viewId - View ID
 * @param payload - Fields to update (name, view_json, is_shared)
 * @returns Updated view
 */
export async function updateView(viewId: string, payload: UpdateViewPayload): Promise<SavedView> {
  const response = await fetch(`${VIEWS_BASE}/${viewId}`, {
    method: 'PATCH',
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update view: ${response.status} - ${error}`);
  }
  
  return response.json();
}

/**
 * Delete a saved view
 * 
 * @param viewId - View ID
 * @returns Delete confirmation
 */
export async function deleteView(viewId: string): Promise<{ ok: boolean; deleted_id: string }> {
  const response = await fetch(`${VIEWS_BASE}/${viewId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete view: ${response.status} - ${error}`);
  }
  
  return response.json();
}
