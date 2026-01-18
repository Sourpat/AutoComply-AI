/**
 * Date Utilities (Phase 3.1: Safe Date Parsing)
 * 
 * Prevents "Invalid Date" errors by validating ISO strings before parsing.
 */

/**
 * Safely format an ISO date string.
 * 
 * Returns formatted string or fallback if invalid.
 * 
 * @param isoString - ISO 8601 date string from backend
 * @param fallback - Fallback text if invalid (default: "Unknown")
 * @returns Formatted date string or fallback
 * 
 * @example
 * safeFormatDate("2026-01-14T10:30:00Z") // "Jan 14, 2026 10:30 AM"
 * safeFormatDate(null) // "Unknown"
 * safeFormatDate("invalid") // "Unknown"
 */
export function safeFormatDate(isoString: string | null | undefined, fallback: string = "Unknown"): string {
  if (!isoString) return fallback;
  
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return fallback;
    }
    
    // Format: "Jan 14, 2026 10:30 AM"
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.warn('[dateUtils] Failed to parse date:', isoString, error);
    return fallback;
  }
}

/**
 * Safely format an ISO date string (date only, no time).
 * 
 * @param isoString - ISO 8601 date string from backend
 * @param fallback - Fallback text if invalid (default: "Unknown")
 * @returns Formatted date string or fallback
 * 
 * @example
 * safeFormatDateOnly("2026-01-14T10:30:00Z") // "Jan 14, 2026"
 */
export function safeFormatDateOnly(isoString: string | null | undefined, fallback: string = "Unknown"): string {
  if (!isoString) return fallback;
  
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return fallback;
    }
    
    // Format: "Jan 14, 2026"
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.warn('[dateUtils] Failed to parse date:', isoString, error);
    return fallback;
  }
}

/**
 * Safely format an ISO date string as relative time (e.g., "2 hours ago").
 * 
 * @param isoString - ISO 8601 date string from backend
 * @param fallback - Fallback text if invalid (default: "Unknown")
 * @returns Relative time string or fallback
 * 
 * @example
 * safeFormatRelative("2026-01-14T08:00:00Z") // "2 hours ago"
 */
export function safeFormatRelative(isoString: string | null | undefined, fallback: string = "Unknown"): string {
  if (!isoString) return fallback;
  
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return fallback;
    }
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    
    // Fall back to absolute date for older events
    return safeFormatDateOnly(isoString, fallback);
  } catch (error) {
    console.warn('[dateUtils] Failed to parse date:', isoString, error);
    return fallback;
  }
}
