/**
 * Scheduled Exports API Client
 * 
 * HTTP client for /workflow/exports/scheduled endpoints.
 * Manages recurring export jobs for cases and saved views.
 */

import { API_BASE } from '../lib/api';
import { getAuthHeaders, getJsonHeaders } from '../lib/authHeaders';
import { cachedFetchJson } from './apiCache';

const EXPORTS_BASE = `${API_BASE}/workflow/exports`;

// ============================================================================
// Types
// ============================================================================

export interface ScheduledExport {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  schedule: 'DAILY' | 'WEEKLY';
  hour: number;
  minute: number;
  timezone: string;
  mode: 'case' | 'saved_view';
  target_id: string;
  export_type: 'pdf' | 'json' | 'both';
  is_enabled: number;
  last_run_at: string | null;
  next_run_at: string | null;
  owner: string | null;
}

export interface CreateScheduledExportPayload {
  name: string;
  schedule: 'DAILY' | 'WEEKLY';
  hour: number;
  minute: number;
  mode: 'case' | 'saved_view';
  target_id: string;
  export_type: 'pdf' | 'json' | 'both';
  timezone?: string;
  is_enabled?: boolean;
}

export interface UpdateScheduledExportPayload {
  name?: string;
  schedule?: 'DAILY' | 'WEEKLY';
  hour?: number;
  minute?: number;
  timezone?: string;
  export_type?: 'pdf' | 'json' | 'both';
  is_enabled?: boolean;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * List scheduled exports
 * 
 * @returns List of scheduled exports
 */
export async function listScheduledExports(): Promise<ScheduledExport[]> {
  return cachedFetchJson<ScheduledExport[]>(`${EXPORTS_BASE}/scheduled`, {
    headers: getAuthHeaders(),
  });
}

/**
 * Create a new scheduled export
 * 
 * @param payload - Export configuration
 * @returns Created export
 */
export async function createScheduledExport(payload: CreateScheduledExportPayload): Promise<ScheduledExport> {
  const response = await fetch(`${EXPORTS_BASE}/scheduled`, {
    method: 'POST',
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create scheduled export: ${response.status} - ${error}`);
  }
  
  return response.json();
}

/**
 * Update a scheduled export
 * 
 * @param exportId - Export ID
 * @param payload - Fields to update
 * @returns Updated export
 */
export async function patchScheduledExport(exportId: string, payload: UpdateScheduledExportPayload): Promise<ScheduledExport> {
  const response = await fetch(`${EXPORTS_BASE}/scheduled/${exportId}`, {
    method: 'PATCH',
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update scheduled export: ${response.status} - ${error}`);
  }
  
  return response.json();
}

/**
 * Delete a scheduled export
 * 
 * @param exportId - Export ID
 * @returns Delete confirmation
 */
export async function deleteScheduledExport(exportId: string): Promise<{ ok: boolean; deleted_id: string }> {
  const response = await fetch(`${EXPORTS_BASE}/scheduled/${exportId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete scheduled export: ${response.status} - ${error}`);
  }
  
  return response.json();
}

/**
 * Trigger a scheduled export to run immediately
 * 
 * @param exportId - Export ID
 * @returns Success message
 */
export async function runNow(exportId: string): Promise<{ ok: boolean; message: string }> {
  const response = await fetch(`${EXPORTS_BASE}/scheduled/${exportId}/run-now`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to run export: ${response.status} - ${error}`);
  }
  
  return response.json();
}
