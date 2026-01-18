/**
 * mapFieldIssues - Utility to map field_issues to form fields
 * 
 * Normalizes field keys and creates a lookup map for efficient rendering.
 */

export interface FieldIssue {
  field: string;
  severity: 'critical' | 'medium' | 'low';
  check?: string;
  message: string;
}

/**
 * Normalize field key for matching:
 * - Lowercase
 * - Trim whitespace
 * - Replace spaces with underscores
 * - Remove special characters
 */
export function normalizeFieldKey(key: string): string {
  return key
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '');
}

/**
 * Build field issue map from array of field issues.
 * 
 * @param fieldIssues - Array of field validation issues
 * @returns Map of normalized field keys to arrays of issues
 * 
 * Example:
 *   Input: [{ field: 'NPI Number', severity: 'critical', message: 'Invalid format' }]
 *   Output: { 'npi_number': [{ field: 'NPI Number', ... }] }
 */
export function buildFieldIssueMap(
  fieldIssues?: Array<FieldIssue>
): Record<string, FieldIssue[]> {
  if (!fieldIssues || fieldIssues.length === 0) {
    return {};
  }

  const map: Record<string, FieldIssue[]> = {};

  for (const issue of fieldIssues) {
    const normalizedKey = normalizeFieldKey(issue.field);
    
    if (!map[normalizedKey]) {
      map[normalizedKey] = [];
    }
    
    map[normalizedKey].push(issue);
  }

  // Sort issues by severity (critical > medium > low) within each field
  const severityOrder = { critical: 0, medium: 1, low: 2 };
  
  for (const key in map) {
    map[key].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }

  return map;
}

/**
 * Get issues for a specific field key.
 * Handles normalization automatically.
 * 
 * @param fieldIssueMap - Map from buildFieldIssueMap
 * @param fieldKey - Original field key (will be normalized)
 * @returns Array of issues for this field, or empty array
 */
export function getFieldIssues(
  fieldIssueMap: Record<string, FieldIssue[]>,
  fieldKey: string
): FieldIssue[] {
  const normalizedKey = normalizeFieldKey(fieldKey);
  return fieldIssueMap[normalizedKey] || [];
}

/**
 * Get the most severe issue for a field.
 * Useful for showing primary warning.
 * 
 * @param fieldIssueMap - Map from buildFieldIssueMap
 * @param fieldKey - Original field key
 * @returns Top-priority issue or undefined
 */
export function getTopFieldIssue(
  fieldIssueMap: Record<string, FieldIssue[]>,
  fieldKey: string
): FieldIssue | undefined {
  const issues = getFieldIssues(fieldIssueMap, fieldKey);
  return issues[0]; // Already sorted by severity
}
