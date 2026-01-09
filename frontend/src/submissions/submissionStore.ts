/**
 * Submission Store
 * 
 * ============================================================================
 * Step 2.8: End-to-End Submission -> Case Creation -> Connected RAG Evidence
 * ============================================================================
 * 
 * PURPOSE:
 * localStorage-backed store for tracking compliance form submissions.
 * Provides stable storage and retrieval of submission records across sessions.
 * 
 * STORAGE KEY:
 * "acai.submissions.v1" - Versioned for future migration compatibility
 * 
 * DEMO-SAFE:
 * - No backend dependency
 * - Safe JSON parsing with fallback
 * - Automatic ID generation (SUB-YYYY-NNNNN format)
 * - Compatible with existing demoStore and work queue
 * 
 * PRODUCTION MIGRATION:
 * Replace localStorage calls with API endpoints:
 * - createSubmission() -> POST /api/submissions
 * - getSubmission(id) -> GET /api/submissions/:id
 * - listSubmissions() -> GET /api/submissions
 * 
 * ============================================================================
 */

import type { SubmissionRecord, CreateSubmissionInput, SubmissionListItem } from './submissionTypes';

const STORAGE_KEY = 'acai.submissions.v1';

/**
 * Generate a unique submission ID in format: SUB-YYYY-NNNNN
 */
function generateSubmissionId(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `SUB-${year}-${random}`;
}

/**
 * Load all submissions from localStorage
 */
function loadSubmissions(): SubmissionRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      console.warn('[submissionStore] Invalid data format, resetting to empty array');
      return [];
    }
    
    return parsed;
  } catch (error) {
    console.error('[submissionStore] Failed to load submissions:', error);
    return [];
  }
}

/**
 * Save all submissions to localStorage
 */
function saveSubmissions(submissions: SubmissionRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
  } catch (error) {
    console.error('[submissionStore] Failed to save submissions:', error);
  }
}

/**
 * Create a new submission record
 * 
 * @param input - Submission data (without id and createdAt)
 * @returns Complete SubmissionRecord with generated id and createdAt
 */
export function createSubmission(input: CreateSubmissionInput): SubmissionRecord {
  const submission: SubmissionRecord = {
    id: generateSubmissionId(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  
  const submissions = loadSubmissions();
  submissions.push(submission);
  saveSubmissions(submissions);
  
  console.log('[submissionStore] Created submission:', submission.id);
  return submission;
}

/**
 * Get a submission by ID
 * 
 * @param id - Submission ID
 * @returns SubmissionRecord or undefined if not found
 */
export function getSubmission(id: string): SubmissionRecord | undefined {
  const submissions = loadSubmissions();
  return submissions.find(sub => sub.id === id);
}

/**
 * List all submissions
 * 
 * @param options - Optional filtering and sorting
 * @returns Array of SubmissionRecords
 */
export function listSubmissions(options?: {
  decisionType?: string;
  status?: string;
  limit?: number;
  sortBy?: 'createdAt' | 'decisionType' | 'status';
  sortDirection?: 'asc' | 'desc';
}): SubmissionRecord[] {
  let submissions = loadSubmissions();
  
  // Filter by decision type
  if (options?.decisionType) {
    submissions = submissions.filter(sub => sub.decisionType === options.decisionType);
  }
  
  // Filter by status
  if (options?.status) {
    submissions = submissions.filter(sub => sub.evaluatorOutput?.status === options.status);
  }
  
  // Sort
  if (options?.sortBy) {
    submissions.sort((a, b) => {
      let aVal: string | undefined;
      let bVal: string | undefined;
      
      switch (options.sortBy) {
        case 'createdAt':
          aVal = a.createdAt;
          bVal = b.createdAt;
          break;
        case 'decisionType':
          aVal = a.decisionType;
          bVal = b.decisionType;
          break;
        case 'status':
          aVal = a.evaluatorOutput?.status;
          bVal = b.evaluatorOutput?.status;
          break;
        default:
          aVal = a.createdAt;
          bVal = b.createdAt;
      }
      
      if (!aVal && !bVal) return 0;
      if (!aVal) return 1;
      if (!bVal) return -1;
      
      const comparison = aVal.localeCompare(bVal);
      return options.sortDirection === 'desc' ? -comparison : comparison;
    });
  }
  
  // Limit results
  if (options?.limit && options.limit > 0) {
    submissions = submissions.slice(0, options.limit);
  }
  
  return submissions;
}

/**
 * Get submission list items (lightweight for tables)
 * 
 * @param options - Optional filtering and sorting
 * @returns Array of SubmissionListItems
 */
export function getSubmissionListItems(options?: Parameters<typeof listSubmissions>[0]): SubmissionListItem[] {
  const submissions = listSubmissions(options);
  
  return submissions.map(sub => ({
    id: sub.id,
    createdAt: sub.createdAt,
    decisionType: sub.decisionType,
    submittedBy: sub.submittedBy?.name || sub.submittedBy?.email,
    status: sub.evaluatorOutput?.status || 'pending',
    riskLevel: sub.evaluatorOutput?.riskLevel,
  }));
}

/**
 * Update an existing submission
 * 
 * @param id - Submission ID
 * @param updates - Partial submission data to update
 * @returns Updated SubmissionRecord or undefined if not found
 */
export function updateSubmission(
  id: string,
  updates: Partial<Omit<SubmissionRecord, 'id' | 'createdAt'>>
): SubmissionRecord | undefined {
  const submissions = loadSubmissions();
  const index = submissions.findIndex(sub => sub.id === id);
  
  if (index === -1) {
    console.warn('[submissionStore] Submission not found:', id);
    return undefined;
  }
  
  submissions[index] = {
    ...submissions[index],
    ...updates,
  };
  
  saveSubmissions(submissions);
  console.log('[submissionStore] Updated submission:', id);
  return submissions[index];
}

/**
 * Delete a submission
 * 
 * @param id - Submission ID
 * @returns true if deleted, false if not found
 */
export function deleteSubmission(id: string): boolean {
  const submissions = loadSubmissions();
  const index = submissions.findIndex(sub => sub.id === id);
  
  if (index === -1) {
    return false;
  }
  
  submissions.splice(index, 1);
  saveSubmissions(submissions);
  console.log('[submissionStore] Deleted submission:', id);
  return true;
}

/**
 * Clear all submissions (for testing/reset)
 */
export function clearAllSubmissions(): void {
  localStorage.removeItem(STORAGE_KEY);
  console.log('[submissionStore] Cleared all submissions');
}

/**
 * Get submission count by decision type
 * 
 * @returns Map of decision type to count
 */
export function getSubmissionCountByType(): Record<string, number> {
  const submissions = loadSubmissions();
  const counts: Record<string, number> = {};
  
  submissions.forEach(sub => {
    counts[sub.decisionType] = (counts[sub.decisionType] || 0) + 1;
  });
  
  return counts;
}

/**
 * Find submission by trace ID
 * 
 * @param traceId - Trace ID from evaluator output
 * @returns SubmissionRecord or undefined if not found
 */
export function findSubmissionByTraceId(traceId: string): SubmissionRecord | undefined {
  const submissions = loadSubmissions();
  return submissions.find(sub => sub.evaluatorOutput?.traceId === traceId);
}

/**
 * Submission Store instance (for class-based usage if needed)
 */
export const submissionStore = {
  create: createSubmission,
  get: getSubmission,
  list: listSubmissions,
  listItems: getSubmissionListItems,
  update: updateSubmission,
  delete: deleteSubmission,
  clearAll: clearAllSubmissions,
  countByType: getSubmissionCountByType,
  findByTraceId: findSubmissionByTraceId,
};

export default submissionStore;
