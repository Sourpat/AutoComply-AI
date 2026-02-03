/**
 * Auth Headers Utility
 * 
 * Provides headers for API requests based on admin_unlocked state.
 * Automatically includes role headers and optional dev seed token.
 */

const metaEnv = (import.meta as any)?.env ?? {};

export const ROLE_HEADER = "x-user-role";
export const AUTO_ROLE_HEADER = "x-autocomply-role";
export const DEV_SEED_HEADER = "x-dev-seed-token";

const DEV_SEED_TOKEN =
  typeof metaEnv.VITE_DEV_SEED_TOKEN === "string" ? metaEnv.VITE_DEV_SEED_TOKEN.trim() : "";

/**
 * Get the user's current role based on admin_unlocked state
 */
export function getCurrentRole(): 'admin' | 'verifier' | 'submitter' | 'devsupport' {
  const stored = localStorage.getItem('acai.role.v1');
  if (stored === 'submitter' || stored === 'verifier' || stored === 'admin' || stored === 'devsupport') {
    return stored;
  }
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
export function withDevSeedToken(headers: Record<string, string>): Record<string, string> {
  if (DEV_SEED_TOKEN) {
    return { ...headers, [DEV_SEED_HEADER]: DEV_SEED_TOKEN };
  }
  return headers;
}

export function getAuthHeaders(): Record<string, string> {
  const role = getCurrentRole();
  return withDevSeedToken({
    [AUTO_ROLE_HEADER]: role,
    [ROLE_HEADER]: role,
  });
}

/**
 * Get headers for JSON API requests with role
 */
export function getJsonHeaders(): Record<string, string> {
  const role = getCurrentRole();
  return withDevSeedToken({
    'Content-Type': 'application/json',
    [AUTO_ROLE_HEADER]: role,
    [ROLE_HEADER]: role,
  });
}
