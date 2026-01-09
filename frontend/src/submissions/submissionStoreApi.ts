/**
 * Submission Store API
 * 
 * API-backed implementation of submission store that matches the localStorage interface.
 */

import type { SubmissionRecord, CreateSubmissionInput } from './submissionTypes';
import * as submissionsApi from '../api/submissionsApi';

/**
 * API-backed submission store
 */
class SubmissionStoreApi {
  async createSubmission(input: CreateSubmissionInput): Promise<SubmissionRecord> {
    return submissionsApi.createSubmission(input);
  }
  
  async getSubmission(id: string): Promise<SubmissionRecord | undefined> {
    return submissionsApi.getSubmission(id);
  }
  
  async listSubmissions(options?: {
    decisionType?: string;
    status?: string;
    limit?: number;
  }): Promise<SubmissionRecord[]> {
    const filters: submissionsApi.SubmissionFilters = {};
    
    if (options?.decisionType) {
      filters.decisionType = options.decisionType;
    }
    
    const results = await submissionsApi.listSubmissions(filters);
    
    // Apply client-side filtering and limiting for now
    let filtered = results;
    
    if (options?.status) {
      filtered = filtered.filter(
        sub => sub.evaluatorOutput?.status === options.status
      );
    }
    
    if (options?.limit && options.limit > 0) {
      filtered = filtered.slice(0, options.limit);
    }
    
    return filtered;
  }
}

export const submissionStoreApi = new SubmissionStoreApi();
