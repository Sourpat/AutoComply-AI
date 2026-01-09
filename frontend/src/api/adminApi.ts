/**
 * Admin API Client
 * 
 * HTTP client functions for /admin endpoints.
 * ⚠️ ADMIN-ONLY OPERATIONS - Use with caution ⚠️
 */

import { API_BASE } from '../lib/api';
import { getAuthHeaders } from '../lib/authHeaders';

const ADMIN_BASE = `${API_BASE}/admin`;

// ============================================================================
// Types
// ============================================================================

export interface ResetPreview {
  tables: Record<string, number>;
  files: {
    exports_dir: number;
  };
  warning: string;
  confirmation_required: string;
}

export interface ResetResponse {
  ok: boolean;
  deleted: {
    tables: Record<string, number>;
    files: number;
  };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Preview reset operation (safe - doesn't delete anything)
 * 
 * Returns counts of what would be deleted.
 * 
 * @returns Preview of deletions
 */
export async function getResetPreview(): Promise<ResetPreview> {
  const response = await fetch(`${ADMIN_BASE}/reset/preview`, {
    headers: getAuthHeaders(),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get reset preview: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Reset all data (⚠️ DESTRUCTIVE ⚠️)
 * 
 * Deletes ALL data from database and export files.
 * CANNOT BE UNDONE.
 * 
 * Requires:
 * - Admin role
 * - Confirmation header: X-AutoComply-Reset-Confirm: RESET
 * 
 * @returns Deletion results
 */
export async function resetAllData(): Promise<ResetResponse> {
  const response = await fetch(`${ADMIN_BASE}/reset`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'X-AutoComply-Reset-Confirm': 'RESET',
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to reset data: ${response.status} - ${error}`);
  }
  
  return response.json();
}
