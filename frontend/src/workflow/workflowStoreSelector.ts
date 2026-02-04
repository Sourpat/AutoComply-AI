/**
 * Workflow Store Selector
 * 
 * Provides automatic fallback between API-backed and localStorage stores.
 * Checks backend health and returns appropriate store implementation.
 */

import { workflowHealth } from '../api/workflowApi';
import { demoStore } from '../lib/demoStore';
import { API_BASE } from '../lib/api';
import { workflowStoreApi } from './workflowStoreApi';
import type { WorkQueueItem } from '../types/workQueue';
import type { AuditEvent, AuditEventCreateInput } from '../types/audit';

// Store interface that both implementations must satisfy
export interface WorkflowStore {
  getWorkQueue(): Promise<WorkQueueItem[]> | WorkQueueItem[];
  addWorkQueueItem(item: Omit<WorkQueueItem, 'id'> & { id?: string }): Promise<WorkQueueItem> | WorkQueueItem;
  updateWorkQueueItem(id: string, patch: Partial<WorkQueueItem>): Promise<WorkQueueItem | null> | WorkQueueItem | null;
  deleteWorkQueueItem(id: string): Promise<boolean> | boolean;
  getAuditEvents(caseId?: string): Promise<AuditEvent[]> | AuditEvent[];
  addAuditEvent(input: AuditEventCreateInput): Promise<AuditEvent> | AuditEvent;
}

// Cache for health check result
let healthCheckCache: { isHealthy: boolean; timestamp: number } | null = null;
const HEALTH_CHECK_CACHE_MS = 30000; // 30 seconds

/**
 * Check if backend is healthy
 */
async function checkBackendHealth(force = false): Promise<boolean> {
  // Use cache if available and fresh
  if (!force && healthCheckCache && Date.now() - healthCheckCache.timestamp < HEALTH_CHECK_CACHE_MS) {
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
    
    console.log('[WorkflowStore] Backend health check:', isHealthy ? '✅ OK' : '❌ Failed');
    return isHealthy;
  } catch (error) {
    console.log('[WorkflowStore] Backend unavailable, using localStorage fallback');
    healthCheckCache = { isHealthy: false, timestamp: Date.now() };
    return false;
  }
}

/**
 * Adapter to make demoStore async-compatible
 */
class DemoStoreAdapter implements WorkflowStore {
  async getWorkQueue(): Promise<WorkQueueItem[]> {
    return demoStore.getWorkQueue();
  }
  
  async addWorkQueueItem(item: Omit<WorkQueueItem, 'id'> & { id?: string }): Promise<WorkQueueItem> {
    return demoStore.addWorkQueueItem(item);
  }
  
  async updateWorkQueueItem(id: string, patch: Partial<WorkQueueItem>): Promise<WorkQueueItem | null> {
    return demoStore.updateWorkQueueItem(id, patch);
  }
  
  async deleteWorkQueueItem(id: string): Promise<boolean> {
    return demoStore.deleteWorkQueueItem(id);
  }
  
  async getAuditEvents(caseId?: string): Promise<AuditEvent[]> {
    return demoStore.getAuditEvents(caseId);
  }
  
  async addAuditEvent(input: AuditEventCreateInput): Promise<AuditEvent> {
    return demoStore.addAuditEvent(input);
  }
}

const demoStoreAdapter = new DemoStoreAdapter();

/**
 * Get the appropriate workflow store based on backend health
 * 
 * CRITICAL: No longer falls back to demo store when backend is unreachable.
 * This ensures UI shows proper error states instead of stale demo data.
 */
export async function getWorkflowStore(force = false): Promise<WorkflowStore> {
  const isHealthy = await checkBackendHealth(force);
  
  if (!isHealthy) {
    throw new Error(
      `Backend not reachable. Please ensure backend is running on ${API_BASE}\n` +
      'Start with: uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001'
    );
  }
  
  return workflowStoreApi;
}

/**
 * Clear health check cache (useful for testing or manual refresh)
 */
export function clearHealthCheckCache(): void {
  healthCheckCache = null;
  console.log('[WorkflowStore] Health check cache cleared');
}

/**
 * Force use of API store (for testing)
 */
export function useApiStore(): WorkflowStore {
  return workflowStoreApi;
}

/**
 * Force use of demo store (for offline mode)
 */
export function useDemoStore(): WorkflowStore {
  return demoStoreAdapter;
}
