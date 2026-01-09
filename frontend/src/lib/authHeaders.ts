/**
 * Auth Headers Utility
 * 
 * Provides headers for API requests based on admin_unlocked state.
 * Automatically includes X-AutoComply-Role header.
 */

/**
 * Get the user's current role based on admin_unlocked state
 */
export function getCurrentRole(): 'admin' | 'verifier' {
  return localStorage.getItem('admin_unlocked') === 'true' ? 'admin' : 'verifier';
}

/**
 * Check if user is admin
 */
export function isAdmin(): boolean {
  return getCurrentRole() === 'admin';
}

/**
 * Check if admin mode is unlocked
 * Used to gate tour UI and other admin-only features
 */
export function isAdminUnlocked(): boolean {
  return localStorage.getItem('admin_unlocked') === 'true';
}

/**
 * Get base headers for API requests with role
 */
export function getAuthHeaders(): Record<string, string> {
  return {
    'X-AutoComply-Role': getCurrentRole(),
  };
}

/**
 * Get headers for JSON API requests with role
 */
export function getJsonHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-AutoComply-Role': getCurrentRole(),
  };
}
