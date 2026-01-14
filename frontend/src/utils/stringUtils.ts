/**
 * Utility functions for safe string operations
 */

/**
 * Safely converts a value to a string, handling null/undefined
 * @param value - The value to convert
 * @param fallback - Fallback string if value is null/undefined (default: '')
 * @returns Safe string
 */
export function safeString(value: unknown, fallback: string = ''): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

/**
 * Safely formats a snake_case or SCREAMING_SNAKE_CASE string to Title Case
 * @param value - The value to format
 * @param fallback - Fallback string if value is null/undefined (default: 'N/A')
 * @returns Formatted string
 */
export function formatSnakeCase(value: unknown, fallback: string = 'N/A'): string {
  const str = safeString(value, fallback);
  if (!str || str === fallback) return fallback;
  
  return str
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Safely converts string to uppercase
 * @param value - The value to uppercase
 * @param fallback - Fallback string if value is null/undefined (default: '')
 * @returns Uppercase string
 */
export function safeUpperCase(value: unknown, fallback: string = ''): string {
  return safeString(value, fallback).toUpperCase();
}

/**
 * Safely replaces all occurrences in a string
 * @param value - The value to process
 * @param search - String or regex to search for
 * @param replacement - Replacement string
 * @param fallback - Fallback if value is null/undefined (default: '')
 * @returns Processed string
 */
export function safeReplace(
  value: unknown,
  search: string | RegExp,
  replacement: string,
  fallback: string = ''
): string {
  return safeString(value, fallback).replace(search, replacement);
}
