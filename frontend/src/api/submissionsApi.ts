/**
 * Submissions API Client
 * 
 * HTTP client functions for /submissions endpoints.
 */

import { API_BASE } from '../lib/api';
import { getAuthHeaders, getJsonHeaders } from '../lib/authHeaders';
import { cachedFetchJson } from './apiCache';
import type { SubmissionRecord, CreateSubmissionInput } from '../submissions/submissionTypes';

const SUBMISSIONS_BASE = `${API_BASE}/submissions`;

export interface SubmissionFilters {
  decisionType?: string;
  submittedBy?: string;
  accountId?: string;
  locationId?: string;
}

/**
 * Create a new submission
 */
export async function createSubmission(input: CreateSubmissionInput): Promise<SubmissionRecord> {
  const payload = {
    decisionType: input.decisionType,
    submittedBy: input.submittedBy?.email || input.submittedBy?.name,
    accountId: input.accountId,
    locationId: input.locationId,
    formData: input.formData,
    rawPayload: input.rawPayload,
    evaluatorOutput: input.evaluatorOutput,
  };
  
  const response = await fetch(SUBMISSIONS_BASE, {
    method: 'POST',
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create submission: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Map backend response to frontend SubmissionRecord format
  return {
    id: data.id,
    createdAt: data.createdAt,
    decisionType: data.decisionType,
    submittedBy: data.submittedBy ? { email: data.submittedBy } : undefined,
    accountId: data.accountId,
    locationId: data.locationId,
    formData: data.formData,
    rawPayload: data.rawPayload,
    evaluatorOutput: data.evaluatorOutput,
  } as SubmissionRecord;
}

/**
 * Get a submission by ID
 */
export async function getSubmission(id: string): Promise<SubmissionRecord | undefined> {
  try {
    const data = await cachedFetchJson<any>(`${SUBMISSIONS_BASE}/${id}`, {
      headers: getAuthHeaders(),
    });
    
    return {
      id: data.id,
      createdAt: data.createdAt,
      decisionType: data.decisionType,
      submittedBy: data.submittedBy ? { email: data.submittedBy } : undefined,
      accountId: data.accountId,
      locationId: data.locationId,
      formData: data.formData,
      rawPayload: data.rawPayload,
      evaluatorOutput: data.evaluatorOutput,
    } as SubmissionRecord;
  } catch (error: any) {
    if (error.message?.includes('404')) {
      return undefined;
    }
    throw error;
  }
}

/**
 * List submissions with optional filters
 */
export async function listSubmissions(filters?: SubmissionFilters): Promise<SubmissionRecord[]> {
  const params = new URLSearchParams();
  
  if (filters?.decisionType) params.set('decisionType', filters.decisionType);
  if (filters?.submittedBy) params.set('submittedBy', filters.submittedBy);
  if (filters?.accountId) params.set('accountId', filters.accountId);
  if (filters?.locationId) params.set('locationId', filters.locationId);
  
  const url = params.toString() 
    ? `${SUBMISSIONS_BASE}?${params}` 
    : SUBMISSIONS_BASE;
  
  const data = await cachedFetchJson<any[]>(url, {
    headers: getAuthHeaders(),
  });
  
  // Map backend responses to frontend SubmissionRecord format
  return data.map((item: any) => ({
    id: item.id,
    createdAt: item.createdAt,
    decisionType: item.decisionType,
    submittedBy: item.submittedBy ? { email: item.submittedBy } : undefined,
    accountId: item.accountId,
    locationId: item.locationId,
    formData: item.formData,
    rawPayload: item.rawPayload,
    evaluatorOutput: item.evaluatorOutput,
  })) as SubmissionRecord[];
}
