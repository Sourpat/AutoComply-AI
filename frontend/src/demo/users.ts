/**
 * Demo Users for Assignment
 * 
 * These users are available for assigning verification cases.
 * In a production environment, these would come from an API.
 */

export interface DemoUser {
  id: string;
  name: string;
  role: 'verifier' | 'admin';
}

/**
 * Demo verifiers available for case assignment
 */
export const DEMO_VERIFIERS: DemoUser[] = [
  { id: 'u1', name: 'A. Verifier', role: 'verifier' },
  { id: 'u2', name: 'S. Analyst', role: 'verifier' },
  { id: 'u3', name: 'Y. Reviewer', role: 'verifier' },
];

/**
 * Demo admin user
 */
export const DEMO_ADMIN: DemoUser = {
  id: 'u-admin',
  name: 'Admin User',
  role: 'admin',
};

/**
 * Get current demo user based on role
 * For demo purposes:
 * - verifier role → first verifier (A. Verifier)
 * - admin role → admin user
 * - submitter role → null (submitters can't assign)
 */
export function getCurrentDemoUser(role: string): DemoUser | null {
  if (role === 'verifier') {
    return DEMO_VERIFIERS[0]; // A. Verifier
  }
  if (role === 'admin') {
    return DEMO_ADMIN;
  }
  return null; // Submitter or unknown role
}

/**
 * Get all assignable users (verifiers + admin)
 */
export function getAllAssignableUsers(): DemoUser[] {
  return [...DEMO_VERIFIERS, DEMO_ADMIN];
}
