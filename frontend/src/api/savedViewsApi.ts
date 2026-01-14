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
  try {
    const params = new URLSearchParams();
    if (scope) {
      params.set('scope', scope);
    }
    
    const url = params.toString() 
      ? `${VIEWS_BASE}?${params}` 
      : VIEWS_BASE;
    
    return await cachedFetchJson<SavedView[]>(url, {
      headers: getAuthHeaders(),
    });
  } catch (err) {
    // Fallback to localStorage if backend is unavailable
    console.warn('[SavedViewsAPI] Backend unavailable, using localStorage fallback');
    const stored = localStorage.getItem('ac_saved_views');
    if (!stored) return [];
    const allViews: SavedView[] = JSON.parse(stored);
    return scope ? allViews.filter(v => v.scope === scope) : allViews;
  }
}

/**
 * Create a new saved view
 * 
 * @param payload - View data (name, scope, view_json, is_shared)
 * @returns Created view
 */
export async function createView(payload: CreateViewPayload): Promise<SavedView> {
  try {
    const response = await fetch(VIEWS_BASE, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (err) {
    // Fallback to localStorage
    console.warn('[SavedViewsAPI] Backend unavailable, saving to localStorage');
    const stored = localStorage.getItem('ac_saved_views');
    const allViews: SavedView[] = stored ? JSON.parse(stored) : [];
    
    const newView: SavedView = {
      id: `view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      name: payload.name,
      scope: payload.scope,
      view_json: payload.view_json,
      owner: 'local',
      is_shared: payload.is_shared ?? false,
    };
    
    allViews.push(newView);
    localStorage.setItem('ac_saved_views', JSON.stringify(allViews));
    return newView;
  }
}

/**
 * Get a saved view by ID
 * 
 * @param viewId - View ID
 * @returns Saved view
 */
export async function getView(viewId: string): Promise<SavedView> {
  try {
    return await cachedFetchJson<SavedView>(`${VIEWS_BASE}/${viewId}`, {
      headers: getAuthHeaders(),
    });
  } catch (err) {
    // Fallback to localStorage
    console.warn('[SavedViewsAPI] Backend unavailable, reading from localStorage');
    const stored = localStorage.getItem('ac_saved_views');
    const allViews: SavedView[] = stored ? JSON.parse(stored) : [];
    
    const view = allViews.find(v => v.id === viewId);
    if (!view) {
      throw new Error(`View ${viewId} not found in localStorage`);
    }
    
    return view;
  }
}

/**
 * Update a saved view
 * 
 * @param viewId - View ID
 * @param payload - Fields to update (name, view_json, is_shared)
 * @returns Updated view
 */
export async function updateView(viewId: string, payload: UpdateViewPayload): Promise<SavedView> {
  try {
    const response = await fetch(`${VIEWS_BASE}/${viewId}`, {
      method: 'PATCH',
      headers: getJsonHeaders(),
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (err) {
    // Fallback to localStorage
    console.warn('[SavedViewsAPI] Backend unavailable, updating in localStorage');
    const stored = localStorage.getItem('ac_saved_views');
    const allViews: SavedView[] = stored ? JSON.parse(stored) : [];
    
    const index = allViews.findIndex(v => v.id === viewId);
    if (index === -1) {
      throw new Error(`View ${viewId} not found`);
    }
    
    const updated: SavedView = {
      ...allViews[index],
      ...payload,
      updated_at: new Date().toISOString(),
    };
    
    allViews[index] = updated;
    localStorage.setItem('ac_saved_views', JSON.stringify(allViews));
    return updated;
  }
}

/**
 * Delete a saved view
 * 
 * @param viewId - View ID
 * @returns Delete confirmation
 */
export async function deleteView(viewId: string): Promise<{ ok: boolean; deleted_id: string }> {
  try {
    const response = await fetch(`${VIEWS_BASE}/${viewId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (err) {
    // Fallback to localStorage
    console.warn('[SavedViewsAPI] Backend unavailable, deleting from localStorage');
    const stored = localStorage.getItem('ac_saved_views');
    const allViews: SavedView[] = stored ? JSON.parse(stored) : [];
    
    const filtered = allViews.filter(v => v.id !== viewId);
    localStorage.setItem('ac_saved_views', JSON.stringify(filtered));
    
    return { ok: true, deleted_id: viewId };
  }
}
