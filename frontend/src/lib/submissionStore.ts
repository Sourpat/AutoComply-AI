/**
 * Client-side submission store using localStorage.
 * 
 * Shared between Compliance Console (writes submissions) and RAG Explorer (reads submissions).
 * Keeps recent submissions for connected mode evaluation.
 */

const STORAGE_KEY = "autocomply_submissions";
const MAX_SUBMISSIONS = 25;

export interface SubmissionPayload {
  id: string;
  tenantId: string;
  type: string; // "csf_practitioner", "csf_facility", "ohio_tddd", "ny_pharmacy_license", etc.
  title: string;
  status: string; // "submitted", "blocked", "needs_review", etc.
  risk?: string; // "Low", "Medium", "High"
  createdAt: string; // ISO timestamp
  scenarioKey?: string; // Maps to mock scenario for evaluation
  payload: Record<string, any>; // Full CSF form + decision data
  traceId?: string;
  // Additional fields for UI display
  subtitle?: string;
  priority?: string;
}

class SubmissionStore {
  private getAll(): SubmissionPayload[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (err) {
      console.error("Failed to read submissions from localStorage:", err);
      return [];
    }
  }

  private saveAll(submissions: SubmissionPayload[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
    } catch (err) {
      console.error("Failed to save submissions to localStorage:", err);
    }
  }

  /**
   * Add a new submission (or update if id exists).
   * Keeps only the most recent MAX_SUBMISSIONS.
   */
  addSubmission(submission: SubmissionPayload): void {
    const submissions = this.getAll();
    
    // Remove old submission with same id if exists
    const filtered = submissions.filter(s => s.id !== submission.id);
    
    // Add new submission at front
    filtered.unshift(submission);
    
    // Keep only most recent MAX_SUBMISSIONS
    const trimmed = filtered.slice(0, MAX_SUBMISSIONS);
    
    this.saveAll(trimmed);
  }

  /**
   * Add multiple submissions at once (batch operation).
   */
  addSubmissions(newSubmissions: SubmissionPayload[]): void {
    const existing = this.getAll();
    const existingIds = new Set(existing.map(s => s.id));
    
    // Only add new ones that don't exist
    const toAdd = newSubmissions.filter(s => !existingIds.has(s.id));
    
    if (toAdd.length === 0) return;
    
    // Merge and sort by createdAt descending
    const merged = [...toAdd, ...existing].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    // Keep only most recent MAX_SUBMISSIONS
    const trimmed = merged.slice(0, MAX_SUBMISSIONS);
    
    this.saveAll(trimmed);
  }

  /**
   * List submissions with optional filters.
   */
  listSubmissions(options?: { 
    tenantId?: string; 
    limit?: number;
    type?: string;
  }): SubmissionPayload[] {
    let submissions = this.getAll();
    
    // Filter by tenantId
    if (options?.tenantId) {
      submissions = submissions.filter(s => s.tenantId === options.tenantId);
    }
    
    // Filter by type
    if (options?.type) {
      submissions = submissions.filter(s => s.type === options.type);
    }
    
    // Apply limit
    if (options?.limit) {
      submissions = submissions.slice(0, options.limit);
    }
    
    return submissions;
  }

  /**
   * Get a single submission by id.
   */
  getSubmission(id: string): SubmissionPayload | null {
    const submissions = this.getAll();
    return submissions.find(s => s.id === id) || null;
  }

  /**
   * Get a single submission by traceId.
   */
  getSubmissionByTraceId(traceId: string): SubmissionPayload | null {
    const submissions = this.getAll();
    return submissions.find(s => s.traceId === traceId) || null;
  }

  /**
   * Clear all submissions (dev/testing only).
   */
  clearSubmissions(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Get count of submissions.
   */
  getCount(tenantId?: string): number {
    return this.listSubmissions({ tenantId }).length;
  }
}

// Singleton instance
export const submissionStore = new SubmissionStore();
