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
export async function listSubmissions(filters?: SubmissionFilters & { includeDeleted?: boolean }): Promise<SubmissionRecord[]> {
  const params = new URLSearchParams();
  
  if (filters?.decisionType) params.set('decisionType', filters.decisionType);
  if (filters?.submittedBy) params.set('submittedBy', filters.submittedBy);
  if (filters?.accountId) params.set('accountId', filters.accountId);
  if (filters?.locationId) params.set('locationId', filters.locationId);
  if (filters?.includeDeleted) params.set('includeDeleted', 'true');
  
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
    updatedAt: item.updatedAt,
    decisionType: item.decisionType,
    submittedBy: item.submittedBy ? { email: item.submittedBy } : undefined,
    accountId: item.accountId,
    locationId: item.locationId,
    formData: item.formData,
    rawPayload: item.rawPayload,
    evaluatorOutput: item.evaluatorOutput,
    isDeleted: item.isDeleted,
    deletedAt: item.deletedAt,
  })) as SubmissionRecord[];
}

/**
 * Update an existing submission (PATCH)
 */
export async function updateSubmission(
  id: string, 
  data: Partial<Pick<CreateSubmissionInput, 'formData' | 'decisionType' | 'submittedBy'>>
): Promise<SubmissionRecord> {
  const payload: Record<string, any> = {};
  
  if (data.formData !== undefined) payload.formData = data.formData;
  if (data.decisionType !== undefined) payload.decisionType = data.decisionType;
  if (data.submittedBy !== undefined) {
    payload.submittedBy = data.submittedBy?.email || data.submittedBy?.name;
  }
  
  const response = await fetch(`${SUBMISSIONS_BASE}/${id}`, {
    method: 'PATCH',
    headers: getJsonHeaders(),
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 403) {
      throw new Error('Cannot edit: Review has already started or case is in a non-editable state');
    } else if (response.status === 410) {
      throw new Error('Submission has been deleted');
    }
    throw new Error(`Failed to update submission: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  
  return {
    id: result.id,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    decisionType: result.decisionType,
    submittedBy: result.submittedBy ? { email: result.submittedBy } : undefined,
    accountId: result.accountId,
    locationId: result.locationId,
    formData: result.formData,
    rawPayload: result.rawPayload,
    evaluatorOutput: result.evaluatorOutput,
    isDeleted: result.isDeleted,
    deletedAt: result.deletedAt,
  } as SubmissionRecord;
}

/**
 * Delete a submission (soft delete)
 */
export async function deleteSubmission(id: string): Promise<void> {
  const response = await fetch(`${SUBMISSIONS_BASE}/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 403) {
      throw new Error('Cannot delete: Submission is assigned to a reviewer or case has progressed beyond "new" status');
    }
    throw new Error(`Failed to delete submission: ${response.status} - ${errorText}`);
  }
}
