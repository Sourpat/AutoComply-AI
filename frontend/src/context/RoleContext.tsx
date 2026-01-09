/**
 * Role Context
 * 
 * Manages user role (submitter, verifier, admin) with localStorage persistence
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'submitter' | 'verifier' | 'admin';

interface RoleContextValue {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isSubmitter: boolean;
  isVerifier: boolean;
  isAdmin: boolean;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

const ROLE_STORAGE_KEY = 'acai.role.v1';
const DEFAULT_ROLE: UserRole = 'verifier';

/**
 * Get role from localStorage or default
 */
function getStoredRole(): UserRole {
  try {
    const stored = localStorage.getItem(ROLE_STORAGE_KEY);
    if (stored === 'submitter' || stored === 'verifier' || stored === 'admin') {
      return stored;
    }
  } catch (error) {
    console.warn('[RoleContext] Failed to read role from localStorage:', error);
  }
  return DEFAULT_ROLE;
}

/**
 * Save role to localStorage
 */
function saveRole(role: UserRole): void {
  try {
    localStorage.setItem(ROLE_STORAGE_KEY, role);
    console.log('[RoleContext] Saved role:', role);
  } catch (error) {
    console.warn('[RoleContext] Failed to save role to localStorage:', error);
  }
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>(getStoredRole);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    saveRole(newRole);
    console.log('[RoleContext] Role changed to:', newRole);
  };

  // Compute derived flags
  const isSubmitter = role === 'submitter';
  const isVerifier = role === 'verifier';
  const isAdmin = role === 'admin';

  const value: RoleContextValue = {
    role,
    setRole,
    isSubmitter,
    isVerifier,
    isAdmin
  };

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}

/**
 * Hook to access role context
 */
export function useRole(): RoleContextValue {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}

/**
 * Get display name for role
 */
export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    submitter: 'Submitter',
    verifier: 'Verifier',
    admin: 'Admin'
  };
  return names[role];
}

/**
 * Get role icon
 */
export function getRoleIcon(role: UserRole): string {
  const icons: Record<UserRole, string> = {
    submitter: '📝',
    verifier: '✅',
    admin: '⚙️'
  };
  return icons[role];
}
