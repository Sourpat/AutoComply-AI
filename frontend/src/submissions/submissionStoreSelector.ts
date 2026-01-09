/**
 * Submission Store Selector
 * 
 * Provides automatic fallback between API-backed and localStorage submission stores.
 */

import { workflowHealth } from '../api/workflowApi';
import { createSubmission as createSubmissionLocal, getSubmission as getSubmissionLocal, listSubmissions as listSubmissionsLocal } from './submissionStore';
import { submissionStoreApi } from './submissionStoreApi';
import type { SubmissionRecord, CreateSubmissionInput } from './submissionTypes';

// Cache for health check result
let healthCheckCache: { isHealthy: boolean; timestamp: number } | null = null;
const HEALTH_CHECK_CACHE_MS = 30000; // 30 seconds

/**
 * Check if backend is healthy
 */
async function checkBackendHealth(): Promise<boolean> {
  // Use cache if available and fresh
  if (healthCheckCache && Date.now() - healthCheckCache.timestamp < HEALTH_CHECK_CACHE_MS) {
    return healthCheckCache.isHealthy;
  }
  
  try {
    const result = await Promise.race([
      workflowHealth(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Health check timeout')), 3000)
      ),
    ]);
    
    const isHealthy = result?.ok === true;
    healthCheckCache = { isHealthy, timestamp: Date.now() };
    return isHealthy;
  } catch (error) {
    healthCheckCache = { isHealthy: false, timestamp: Date.now() };
    return false;
  }
}

/**
 * Create submission with automatic fallback
 */
export async function createSubmission(input: CreateSubmissionInput): Promise<SubmissionRecord> {
  const isHealthy = await checkBackendHealth();
  
  if (isHealthy) {
    try {
      return await submissionStoreApi.createSubmission(input);
    } catch (error) {
      console.warn('[SubmissionStore] API failed, falling back to localStorage:', error);
      healthCheckCache = { isHealthy: false, timestamp: Date.now() };
    }
  }
  
  return createSubmissionLocal(input);
}

/**
 * Get submission with automatic fallback
 */
export async function getSubmission(id: string): Promise<SubmissionRecord | undefined> {
  const isHealthy = await checkBackendHealth();
  
  if (isHealthy) {
    try {
      return await submissionStoreApi.getSubmission(id);
    } catch (error) {
      console.warn('[SubmissionStore] API failed, falling back to localStorage:', error);
      healthCheckCache = { isHealthy: false, timestamp: Date.now() };
    }
  }
  
  return getSubmissionLocal(id);
}

/**
 * List submissions with automatic fallback
 */
export async function listSubmissions(options?: {
  decisionType?: string;
  status?: string;
  limit?: number;
}): Promise<SubmissionRecord[]> {
  const isHealthy = await checkBackendHealth();
  
  if (isHealthy) {
    try {
      return await submissionStoreApi.listSubmissions(options);
    } catch (error) {
      console.warn('[SubmissionStore] API failed, falling back to localStorage:', error);
      healthCheckCache = { isHealthy: false, timestamp: Date.now() };
    }
  }
  
  return listSubmissionsLocal(options);
}

/**
 * Clear health check cache
 */
export function clearHealthCheckCache(): void {
  healthCheckCache = null;
}
