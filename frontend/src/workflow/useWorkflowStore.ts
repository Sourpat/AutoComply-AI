/**
 * React Hooks for Workflow Store
 * 
 * Provides React-friendly hooks for accessing workflow store with automatic fallback.
 */

import { useState, useEffect, useCallback } from 'react';
import { getWorkflowStore } from './workflowStoreSelector';
import type { WorkQueueItem } from '../types/workQueue';
import type { AuditEvent, AuditEventCreateInput } from '../types/audit';

/**
 * Hook to get workflow store
 * Returns store instance that's ready to use
 */
export function useWorkflowStore() {
  const [store, setStore] = useState<Awaited<ReturnType<typeof getWorkflowStore>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    getWorkflowStore().then((s) => {
      setStore(s);
      setIsLoading(false);
    });
  }, []);
  
  return { store, isLoading };
}

/**
 * Hook to load work queue
 * Automatically loads and refreshes queue
 */
export function useWorkQueue(autoRefresh = true) {
  const [items, setItems] = useState<WorkQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const loadQueue = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const store = await getWorkflowStore();
      const queue = await store.getWorkQueue();
      setItems(queue);
    } catch (err) {
      setError(err as Error);
      console.error('[useWorkQueue] Failed to load queue:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadQueue();
  }, [loadQueue]);
  
  return { items, isLoading, error, reload: loadQueue };
}

/**
 * Hook for case operations
 * Provides functions to update/assign/delete cases
 */
export function useCaseOperations() {
  const updateCase = useCallback(async (
    caseId: string,
    patch: Partial<WorkQueueItem>
  ): Promise<WorkQueueItem | null> => {
    const store = await getWorkflowStore();
    return store.updateWorkQueueItem(caseId, patch);
  }, []);
  
  const assignCase = useCallback(async (
    caseId: string,
    assignee: { id: string; name: string }
  ): Promise<WorkQueueItem | null> => {
    const store = await getWorkflowStore();
    return store.updateWorkQueueItem(caseId, { assignedTo: assignee });
  }, []);
  
  const unassignCase = useCallback(async (
    caseId: string
  ): Promise<WorkQueueItem | null> => {
    const store = await getWorkflowStore();
    return store.updateWorkQueueItem(caseId, { assignedTo: null });
  }, []);
  
  const deleteCase = useCallback(async (caseId: string): Promise<boolean> => {
    const store = await getWorkflowStore();
    return store.deleteWorkQueueItem(caseId);
  }, []);
  
  return { updateCase, assignCase, unassignCase, deleteCase };
}

/**
 * Hook for audit events
 * Loads and manages audit timeline for a case
 */
export function useAuditEvents(caseId?: string) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const loadEvents = useCallback(async () => {
    if (!caseId) {
      setEvents([]);
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      const store = await getWorkflowStore();
      const timeline = await store.getAuditEvents(caseId);
      setEvents(timeline);
    } catch (err) {
      console.error('[useAuditEvents] Failed to load events:', err);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);
  
  const addEvent = useCallback(async (
    event: AuditEventCreateInput
  ): Promise<AuditEvent> => {
    const store = await getWorkflowStore();
    const newEvent = await store.addAuditEvent(event);
    setEvents(prev => [...prev, newEvent]);
    return newEvent;
  }, []);
  
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);
  
  return { events, isLoading, reload: loadEvents, addEvent };
}
