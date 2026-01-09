/**
 * SLA (Service Level Agreement) Computation Helpers
 * 
 * Functions for calculating case age, due dates, and overdue status.
 */

import type { ItemKind } from '../types/workQueue';

/**
 * Default SLA hours by case kind
 */
export const DEFAULT_SLA_HOURS: Record<ItemKind, number> = {
  csf: 24,      // CSF submissions: 24 hours
  license: 48,  // License submissions: 48 hours
};

/**
 * Get age in milliseconds since creation
 */
export function getAgeMs(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return now - created;
}

/**
 * Format age in short human-readable format
 * Examples: "2h 13m", "1d 4h", "3d"
 */
export function formatAgeShort(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    if (remainingHours > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${days}d`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    if (remainingMinutes > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${seconds}s`;
}

/**
 * Check if a case is overdue
 */
export function isOverdue(dueAt: string | undefined): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  return now > due;
}

/**
 * Format due date in human-readable format
 * Examples: "Due in 3h", "Due in 1d 2h", "Overdue by 2h", "Overdue by 1d"
 */
export function formatDue(dueAt: string | undefined): string {
  if (!dueAt) return 'No SLA';

  const due = new Date(dueAt).getTime();
  const now = Date.now();
  const diff = due - now;

  if (diff > 0) {
    // Due in the future
    return `Due in ${formatAgeShort(diff)}`;
  } else {
    // Overdue
    return `Overdue by ${formatAgeShort(Math.abs(diff))}`;
  }
}

/**
 * Calculate due date from creation time and SLA hours
 */
export function calculateDueDate(createdAt: string, slaHours: number): string {
  const created = new Date(createdAt);
  const due = new Date(created.getTime() + slaHours * 60 * 60 * 1000);
  return due.toISOString();
}

/**
 * Get default SLA hours for a case kind
 */
export function getDefaultSlaHours(kind: ItemKind): number {
  return DEFAULT_SLA_HOURS[kind] || 24;
}

/**
 * Get SLA status color class
 */
export function getSlaStatusColor(dueAt: string | undefined): string {
  if (!dueAt) return 'text-gray-500';
  
  if (isOverdue(dueAt)) {
    return 'text-red-600 font-semibold';
  }

  const due = new Date(dueAt).getTime();
  const now = Date.now();
  const hoursRemaining = (due - now) / (1000 * 60 * 60);

  if (hoursRemaining < 2) {
    return 'text-amber-600 font-semibold'; // Less than 2 hours remaining
  }

  return 'text-gray-700';
}
