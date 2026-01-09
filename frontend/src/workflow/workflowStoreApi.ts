/**
 * Workflow Store API
 * 
 * API-backed implementation of workflow store that matches the demoStore interface.
 * Provides transparent fallback to localStorage when backend is unavailable.
 */

import type { WorkQueueItem, WorkQueueStatus, AssignedUser } from '../types/workQueue';
import type { AuditEvent, AuditEventCreateInput, AuditAction } from '../types/audit';
import * as workflowApi from '../api/workflowApi';

/**
 * Map backend CaseRecord to frontend WorkQueueItem
 */
function mapCaseToWorkQueueItem(caseRecord: workflowApi.CaseRecord): WorkQueueItem {
  // Determine priority based on status and SLA
  let priority: 'low' | 'medium' | 'high' = 'medium';
  if (caseRecord.status === 'blocked') {
    priority = 'high';
  } else if (caseRecord.status === 'needs_info') {
    priority = 'high';
  } else if (new Date(caseRecord.dueAt) < new Date()) {
    priority = 'high'; // Overdue
  }
  
  // Map backend status to frontend WorkQueueStatus
  const statusMap: Record<string, WorkQueueStatus> = {
    'new': 'submitted',
    'in_review': 'needs_review',
    'needs_info': 'needs_review',
    'approved': 'approved',
    'blocked': 'blocked',
    'closed': 'approved',
  };
  
  const kind = caseRecord.decisionType.startsWith('csf') ? 'csf' : 'license';
  
  // Calculate SLA hours from dueAt and createdAt
  const createdMs = new Date(caseRecord.createdAt).getTime();
  const dueMs = new Date(caseRecord.dueAt).getTime();
  const slaHours = Math.round((dueMs - createdMs) / (1000 * 60 * 60));
  
  return {
    id: caseRecord.id,
    kind,
    title: caseRecord.title,
    subtitle: caseRecord.summary,
    status: statusMap[caseRecord.status] || 'submitted',
    priority,
    createdAt: caseRecord.createdAt,
    submissionId: caseRecord.submissionId || undefined,
    assignedTo: caseRecord.assignedTo ? { id: caseRecord.assignedTo, name: caseRecord.assignedTo } : undefined,
    slaHours,
    dueAt: caseRecord.dueAt,
  };
}

/**
 * Map frontend WorkQueueItem to backend CaseCreateInput
 */
function mapWorkQueueItemToCase(item: Omit<WorkQueueItem, 'id'> & { id?: string }): workflowApi.CaseCreateInput {
  return {
    decisionType: item.kind === 'csf' ? 'csf_practitioner' : 'license',
    title: item.title,
    summary: item.subtitle || '',
    respondentName: item.title,
    submittedAt: item.createdAt,
    dueAt: item.dueAt,
    submissionId: item.submissionId,
  };
}

/**
 * Map backend AuditEvent to frontend AuditEvent
 */
function mapBackendAuditEvent(event: workflowApi.AuditEvent): AuditEvent {
  // Map backend eventType to frontend action
  const actionMap: Record<string, string> = {
    'case_created': 'SUBMITTED',
    'status_changed': 'STATUS_CHANGED',
    'assigned': 'ASSIGNED',
    'unassigned': 'UNASSIGNED',
    'evidence_attached': 'EVIDENCE_ATTACHED',
    'packet_updated': 'PACKET_UPDATED',
    'note_added': 'NOTE_ADDED',
  };
  
  return {
    id: event.id,
    caseId: event.caseId,
    actorRole: 'admin' as const,
    actorName: event.actor,
    action: (actionMap[event.eventType] || 'SYSTEM_EVENT') as AuditAction,
    message: event.message,
    createdAt: event.createdAt,
    meta: event.meta || {},
  };
}

/**
 * API-backed workflow store
 */
class WorkflowStoreApi {
  // ========== Work Queue Methods ==========
  
  async getWorkQueue(): Promise<WorkQueueItem[]> {
    const response = await workflowApi.listCases();
    return response.items.map(mapCaseToWorkQueueItem);
  }
  
  async addWorkQueueItem(item: Omit<WorkQueueItem, 'id'> & { id?: string }): Promise<WorkQueueItem> {
    const caseInput = mapWorkQueueItemToCase(item);
    const createdCase = await workflowApi.createCase(caseInput);
    return mapCaseToWorkQueueItem(createdCase);
  }
  
  async updateWorkQueueItem(id: string, patch: Partial<WorkQueueItem>): Promise<WorkQueueItem | null> {
    const casePatch: workflowApi.CasePatchInput = {};
    
    if (patch.title !== undefined) casePatch.title = patch.title;
    if (patch.subtitle !== undefined) casePatch.summary = patch.subtitle;
    if (patch.assignedTo !== undefined) {
      casePatch.assignedTo = patch.assignedTo?.id || null;
    }
    if (patch.dueAt !== undefined) casePatch.dueAt = patch.dueAt;
    
    // Map frontend status to backend status
    if (patch.status !== undefined) {
      const statusMap: Record<WorkQueueStatus, workflowApi.CasePatchInput['status']> = {
        'submitted': 'new',
        'needs_review': 'in_review',
        'blocked': 'blocked',
        'approved': 'approved',
        'request_info': 'needs_info',
      };
      casePatch.status = statusMap[patch.status];
    }
    
    try {
      const updatedCase = await workflowApi.patchCase(id, casePatch);
      return mapCaseToWorkQueueItem(updatedCase);
    } catch (error) {
      console.error('[WorkflowStoreApi] Failed to update case:', error);
      return null;
    }
  }
  
  async deleteWorkQueueItem(id: string): Promise<boolean> {
    // Note: Backend doesn't have delete endpoint yet, so we'll mark as closed
    try {
      await workflowApi.patchCase(id, { status: 'closed' });
      return true;
    } catch (error) {
      console.error('[WorkflowStoreApi] Failed to delete case:', error);
      return false;
    }
  }
  
  // ========== Audit Event Methods ==========
  
  async getAuditEvents(caseId?: string): Promise<AuditEvent[]> {
    if (!caseId) {
      // Backend requires caseId, return empty for now
      // In future, could aggregate from all cases
      return [];
    }
    
    try {
      const response = await workflowApi.listAudit(caseId);
      return response.items.map(mapBackendAuditEvent);
    } catch (error) {
      console.error('[WorkflowStoreApi] Failed to get audit events:', error);
      return [];
    }
  }
  
  async addAuditEvent(input: AuditEventCreateInput): Promise<AuditEvent> {
    // Map frontend action to backend eventType
    const eventTypeMap: Record<string, string> = {
      'SUBMITTED': 'case_created',
      'STATUS_CHANGED': 'status_changed',
      'ASSIGNED': 'assigned',
      'UNASSIGNED': 'unassigned',
      'EVIDENCE_ATTACHED': 'evidence_attached',
      'PACKET_UPDATED': 'packet_updated',
      'NOTE_ADDED': 'note_added',
      'APPROVED': 'status_changed',
      'BLOCKED': 'status_changed',
      'NEEDS_REVIEW': 'status_changed',
    };
    
    const backendEvent: workflowApi.AuditEventCreateInput = {
      eventType: eventTypeMap[input.action] || 'note_added',
      actor: input.actorName || 'user',
      source: 'ui',
      message: input.message || input.action,
      meta: input.meta,
    };
    
    const createdEvent = await workflowApi.addAudit(input.caseId, backendEvent);
    return mapBackendAuditEvent(createdEvent);
  }
  
  // ========== Evidence Methods ==========
  
  async attachEvidence(caseId: string, evidence: any[]): Promise<void> {
    const evidenceItems: workflowApi.EvidenceItem[] = evidence.map((item) => ({
      id: item.id || crypto.randomUUID(),
      source: item.source || 'rag',
      snippet: item.snippet || item.content || '',
      citation: item.citation,
      tags: item.tags,
      metadata: item.metadata,
    }));
    
    await workflowApi.attachEvidence(caseId, { evidence: evidenceItems });
  }
  
  async updateEvidencePacket(caseId: string, packetEvidenceIds: string[]): Promise<void> {
    await workflowApi.updateEvidencePacket(caseId, packetEvidenceIds);
  }
}

export const workflowStoreApi = new WorkflowStoreApi();
