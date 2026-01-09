/**
 * Demo Store - LocalStorage-backed persistence
 * 
 * Provides persistence for Work Queue items and Submissions without requiring a backend database.
 * Uses localStorage with namespaced keys to avoid conflicts.
 * 
 * Usage:
 *   import { demoStore } from './lib/demoStore';
 *   const items = demoStore.getWorkQueue();
 *   demoStore.addWorkQueueItem({ ... });
 */

import type { WorkQueueItem, Submission, ItemKind, WorkQueueStatus, Priority, AssignedUser } from '../types/workQueue';
import type { AuditEvent, AuditEventCreateInput } from '../types/audit';
import { getDefaultSlaHours, calculateDueDate } from '../workflow/sla';

const STORAGE_KEYS = {
  workQueue: 'acai.workQueue.v1',
  submissions: 'acai.submissions.v1',
  auditEvents: 'acai.auditEvents.v1',
} as const;

// Simple UUID fallback for environments without crypto.randomUUID
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: simple UUID v4-like generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class DemoStore {
  // ========== Work Queue Methods ==========

  getWorkQueue(): WorkQueueItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.workQueue);
      if (!data) return [];
      const items: WorkQueueItem[] = JSON.parse(data);
      
      // Migration: Add SLA fields to existing items if missing
      let needsSave = false;
      const migrated = items.map((item) => {
        if (!item.slaHours || !item.dueAt) {
          needsSave = true;
          const slaHours = getDefaultSlaHours(item.kind);
          const dueAt = calculateDueDate(item.createdAt, slaHours);
          return { ...item, slaHours, dueAt };
        }
        return item;
      });
      
      if (needsSave) {
        console.log('[DemoStore] Migrating work queue items with SLA fields');
        this.saveWorkQueue(migrated);
      }
      
      return migrated;
    } catch (err) {
      console.error('[DemoStore] Failed to read work queue:', err);
      return [];
    }
  }

  saveWorkQueue(items: WorkQueueItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.workQueue, JSON.stringify(items));
    } catch (err) {
      console.error('[DemoStore] Failed to save work queue:', err);
    }
  }

  addWorkQueueItem(item: Omit<WorkQueueItem, 'id'> & { id?: string }): WorkQueueItem {
    const items = this.getWorkQueue();
    
    // Set default SLA fields if not provided
    const slaHours = item.slaHours || getDefaultSlaHours(item.kind);
    const dueAt = item.dueAt || calculateDueDate(item.createdAt, slaHours);
    
    const newItem: WorkQueueItem = {
      ...item,
      id: item.id || generateId(),
      slaHours,
      dueAt,
    };
    items.unshift(newItem); // Add to front
    this.saveWorkQueue(items);
    return newItem;
  }

  updateWorkQueueItem(id: string, patch: Partial<WorkQueueItem>): WorkQueueItem | null {
    const items = this.getWorkQueue();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) {
      console.warn(`[DemoStore] Work queue item not found: ${id}`);
      return null;
    }
    const updated = { ...items[index], ...patch };
    items[index] = updated;
    this.saveWorkQueue(items);
    return updated;
  }

  deleteWorkQueueItem(id: string): boolean {
    const items = this.getWorkQueue();
    const filtered = items.filter((item) => item.id !== id);
    if (filtered.length === items.length) {
      return false; // Not found
    }
    this.saveWorkQueue(filtered);
    return true;
  }

  // ========== Submission Methods ==========

  getSubmissions(): Submission[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.submissions);
      if (!data) return [];
      return JSON.parse(data);
    } catch (err) {
      console.error('[DemoStore] Failed to read submissions:', err);
      return [];
    }
  }

  saveSubmissions(items: Submission[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.submissions, JSON.stringify(items));
    } catch (err) {
      console.error('[DemoStore] Failed to save submissions:', err);
    }
  }

  addSubmission(submission: Omit<Submission, 'id'> & { id?: string }): Submission {
    const submissions = this.getSubmissions();
    const newSubmission: Submission = {
      ...submission,
      id: submission.id || generateId(),
    };
    // Dedupe by id
    const filtered = submissions.filter((s) => s.id !== newSubmission.id);
    filtered.unshift(newSubmission); // Add to front
    
    // Keep only most recent 50 submissions
    const trimmed = filtered.slice(0, 50);
    this.saveSubmissions(trimmed);
    return newSubmission;
  }

  getSubmission(id: string): Submission | null {
    const submissions = this.getSubmissions();
    return submissions.find((s) => s.id === id) || null;
  }

  getSubmissionByTraceId(traceId: string): Submission | null {
    const submissions = this.getSubmissions();
    return submissions.find((s) => s.traceId === traceId) || null;
  }

  getRecentSubmissionsByType(kind: ItemKind, limit = 20): Submission[] {
    const submissions = this.getSubmissions();
    return submissions
      .filter((s) => s.kind === kind)
      .slice(0, limit);
  }

  // ========== Utility Methods ==========

  clearDemoData(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.workQueue);
      localStorage.removeItem(STORAGE_KEYS.submissions);
      console.log('[DemoStore] Demo data cleared');
    } catch (err) {
      console.error('[DemoStore] Failed to clear demo data:', err);
    }
  }

  hasData(): boolean {
    return this.getWorkQueue().length > 0 || this.getSubmissions().length > 0;
  }

  // ========== Seeding ==========

  seedDemoDataIfEmpty(): void {
    if (this.hasData()) {
      console.log('[DemoStore] Data already exists, skipping seed');
      return;
    }

    console.log('[DemoStore] Seeding demo data...');

    // Seed 3 demo CSF submissions with realistic payloads
    const demoSubmissions: Submission[] = [
      {
        id: 'demo-sub-1',
        kind: 'csf',
        displayName: 'Ohio Hospital – Main Campus',
        submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        csfType: 'csf_facility',
        tenantId: 'ohio',
        status: 'blocked',
        traceId: 'trace-demo-1',
        payload: {
          facility_name: 'Ohio Hospital Main Campus',
          facility_type: 'hospital',
          state: 'OH',
          dea_number: 'AH1234567',
          // Missing required fields to trigger rules
          // missing: tddd_certificate_number
          order_items: [
            { drug_name: 'Morphine Sulfate', quantity: 100, schedule: 'II' }
          ],
          evidence: {
            facility_name: 'Ohio Hospital Main Campus',
            facility_type: 'hospital',
            state: 'OH',
            dea_number: 'AH1234567',
          }
        },
        decisionTrace: {
          status: 'blocked',
          risk_level: 'High',
          outcome: 'blocked',
          decision_summary: 'Application blocked due to missing TDDD certificate. Ohio hospitals must provide valid TDDD certification for Schedule II controlled substances.',
          fired_rules: [
            {
              id: 'OHIO-TDDD-001',
              title: 'TDDD Certificate Required for Ohio Hospitals',
              severity: 'block',
              jurisdiction: 'Ohio',
              citation: 'ORC 3719.06',
              requirement: 'All Ohio hospitals must maintain a valid Terminal Distributor of Dangerous Drugs (TDDD) certificate.',
              rationale: 'TDDD certificate number is missing or invalid',
              evidence: [
                {
                  docId: 'ohio-tddd-core',
                  docTitle: 'Ohio TDDD Rules #1',
                  jurisdiction: 'Ohio',
                  section: 'ORC 3719.06',
                  snippet: 'All terminal distributors of dangerous drugs must obtain and maintain a valid certificate...'
                },
                {
                  docId: 'ohio-tddd-hospitals',
                  docTitle: 'Ohio Hospital Requirements',
                  jurisdiction: 'Ohio',
                  section: 'Schedule II Attestation',
                  snippet: 'Hospitals handling Schedule II controlled substances require TDDD certification...'
                }
              ]
            }
          ],
          missing_evidence: [
            'Valid TDDD certificate number',
            'Certificate expiration date'
          ],
          next_steps: [
            'Obtain TDDD certificate from Ohio Board of Pharmacy',
            'Submit certificate number in the renewal_docs field',
            'Resubmit CSF form after obtaining certificate'
          ]
        }
      },
      {
        id: 'demo-sub-2',
        kind: 'csf',
        displayName: 'Practitioner CSF – Dr. Sarah Martinez',
        submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
        csfType: 'csf_practitioner',
        tenantId: 'ohio',
        status: 'needs_review',
        traceId: 'trace-demo-2',
        payload: {
          practitioner_name: 'Dr. Sarah Martinez',
          dea_number: 'FM9876543',
          state: 'OH',
          state_license_number: 'OH-87654',
          state_license_expiration: '2025-06-15', // Expiring soon
          npi: '1234567890',
          evidence: {
            practitioner_name: 'Dr. Sarah Martinez',
            dea_number: 'FM9876543',
            state: 'OH',
            state_license_number: 'OH-87654',
            state_license_expiration: '2025-06-15',
            npi: '1234567890',
          }
        },
        decisionTrace: {
          status: 'needs_review',
          risk_level: 'Medium',
          outcome: 'needs_review',
          decision_summary: 'Application flagged for manual review due to approaching license expiration. State medical license expires within 6 months.',
          fired_rules: [
            {
              id: 'STATE-LICENSE-EXPIRY',
              title: 'State License Expiration Warning',
              severity: 'review',
              jurisdiction: 'Ohio',
              citation: 'OAC 4731-1-01',
              requirement: 'Practitioners with licenses expiring within 6 months should renew before placing controlled substance orders.',
              rationale: 'State license expires on 2025-06-15 (within 6 months)',
              evidence: [
                {
                  docId: 'ohio-practitioner-renewal',
                  docTitle: 'Ohio Practitioner License Renewal',
                  jurisdiction: 'Ohio',
                  section: 'OAC 4731-1-01',
                  snippet: 'Medical licenses must be renewed annually. Practitioners should maintain current licensure...'
                }
              ]
            }
          ],
          missing_evidence: [],
          next_steps: [
            'Renew Ohio state medical license',
            'Update license expiration date',
            'Compliance officer will review and approve if license is renewed'
          ]
        }
      },
      {
        id: 'demo-sub-3',
        kind: 'csf',
        displayName: 'Practitioner CSF – Dr. James Wilson (Approved)',
        submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
        csfType: 'csf_practitioner',
        tenantId: 'ohio',
        status: 'approved',
        traceId: 'trace-demo-3',
        payload: {
          practitioner_name: 'Dr. James Wilson',
          dea_number: 'FW1122334',
          state: 'OH',
          state_license_number: 'OH-11223',
          state_license_expiration: '2027-12-31',
          npi: '9876543210',
          evidence: {
            practitioner_name: 'Dr. James Wilson',
            dea_number: 'FW1122334',
            state: 'OH',
            state_license_number: 'OH-11223',
            state_license_expiration: '2027-12-31',
            npi: '9876543210',
          }
        },
        decisionTrace: {
          status: 'ok_to_ship',
          risk_level: 'Low',
          outcome: 'approved',
          decision_summary: 'All regulatory requirements have been met. No blocking violations detected.',
          fired_rules: [],
          evaluated_rules: [
            {
              id: 'DEA-VALID',
              title: 'Valid DEA Registration',
              severity: 'info',
              jurisdiction: 'Federal',
              citation: '21 CFR 1301',
              requirement: 'DEA number must be valid and active',
              status: 'passed'
            },
            {
              id: 'STATE-LICENSE-VALID',
              title: 'Valid State Medical License',
              severity: 'info',
              jurisdiction: 'Ohio',
              citation: 'ORC 4731.14',
              requirement: 'State medical license must be current and not expired',
              status: 'passed'
            }
          ],
          missing_evidence: [],
          next_steps: ['Submission approved. No further action required.'],
          satisfied_requirements: [
            'Valid DEA registration',
            'Current state medical license',
            'Valid NPI number',
            'No disciplinary actions on record'
          ]
        }
      }
    ];

    // Save submissions
    this.saveSubmissions(demoSubmissions);

    // Create corresponding work queue items
    const demoWorkQueue: WorkQueueItem[] = [
      {
        id: 'demo-wq-1',
        kind: 'csf',
        title: 'Ohio Hospital – Main Campus',
        subtitle: 'Missing TDDD certification',
        status: 'blocked',
        priority: 'high',
        priorityColor: 'red',
        createdAt: demoSubmissions[0].submittedAt,
        submissionId: 'demo-sub-1',
        traceId: 'trace-demo-1',
        reason: 'Missing TDDD certification',
        age: '2h ago'
      },
      {
        id: 'demo-wq-2',
        kind: 'csf',
        title: 'Practitioner CSF – Dr. Sarah Martinez',
        subtitle: 'License expiring soon (2025-06-15)',
        status: 'needs_review',
        priority: 'medium',
        priorityColor: 'yellow',
        createdAt: demoSubmissions[1].submittedAt,
        submissionId: 'demo-sub-2',
        traceId: 'trace-demo-2',
        reason: 'License expiring soon',
        age: '4h ago'
      },
      {
        id: 'demo-wq-3',
        kind: 'csf',
        title: 'Practitioner CSF – Dr. James Wilson',
        subtitle: 'All requirements met',
        status: 'approved',
        priority: 'low',
        priorityColor: 'green',
        createdAt: demoSubmissions[2].submittedAt,
        submissionId: 'demo-sub-3',
        traceId: 'trace-demo-3',
        reason: 'Approved',
        age: '6h ago'
      }
    ];

    this.saveWorkQueue(demoWorkQueue);

    console.log('[DemoStore] Seeded 3 submissions and 3 work queue items');
    
    // Seed initial audit events for demo submissions
    this.seedAuditEventsIfEmpty();
  }

  // ========== Audit Event Methods ==========

  getAuditEvents(caseId?: string): AuditEvent[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.auditEvents);
      if (!data) return [];
      const allEvents: AuditEvent[] = JSON.parse(data);
      
      // Filter by caseId if provided
      if (caseId) {
        return allEvents
          .filter((event) => event.caseId === caseId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      
      return allEvents;
    } catch (err) {
      console.error('[DemoStore] Failed to read audit events:', err);
      return [];
    }
  }

  saveAuditEvents(events: AuditEvent[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.auditEvents, JSON.stringify(events));
    } catch (err) {
      console.error('[DemoStore] Failed to save audit events:', err);
    }
  }

  addAuditEvent(input: AuditEventCreateInput): AuditEvent {
    const events = this.getAuditEvents();
    const newEvent: AuditEvent = {
      ...input,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    events.push(newEvent);
    this.saveAuditEvents(events);
    return newEvent;
  }

  seedAuditEventsIfEmpty(): void {
    const existingEvents = this.getAuditEvents();
    if (existingEvents.length > 0) {
      console.log('[DemoStore] Audit events already seeded');
      return;
    }

    const workQueue = this.getWorkQueue();
    const submissions = this.getSubmissions();
    const initialEvents: AuditEvent[] = [];

    // Create SUBMITTED events for each submission
    submissions.forEach((submission) => {
      const queueItem = workQueue.find((item) => item.submissionId === submission.id);
      initialEvents.push({
        id: generateId(),
        caseId: queueItem?.id || submission.id,
        submissionId: submission.id,
        actorRole: 'submitter',
        actorName: (submission.payload as any)?.practitionerName || (submission.payload as any)?.facilityName || 'Submitter',
        action: 'SUBMITTED',
        createdAt: submission.submittedAt,
        meta: {},
      });

      // Add status-specific events for approved/blocked cases
      if (queueItem?.status === 'approved') {
        initialEvents.push({
          id: generateId(),
          caseId: queueItem.id,
          submissionId: submission.id,
          actorRole: 'verifier',
          actorName: 'Verifier',
          action: 'APPROVED',
          message: 'All requirements met',
          createdAt: new Date(new Date(submission.submittedAt).getTime() + 60000).toISOString(), // 1 min later
          meta: {},
        });
      } else if (queueItem?.status === 'blocked') {
        initialEvents.push({
          id: generateId(),
          caseId: queueItem.id,
          submissionId: submission.id,
          actorRole: 'verifier',
          actorName: 'Verifier',
          action: 'BLOCKED',
          message: queueItem.reason || 'Missing required information',
          createdAt: new Date(new Date(submission.submittedAt).getTime() + 120000).toISOString(), // 2 min later
          meta: {
            missingFields: ['DEA number', 'State license'],
          },
        });
      } else if (queueItem?.status === 'needs_review') {
        initialEvents.push({
          id: generateId(),
          caseId: queueItem.id,
          submissionId: submission.id,
          actorRole: 'verifier',
          actorName: 'Verifier',
          action: 'NEEDS_REVIEW',
          message: queueItem.reason || 'Flagged for manual review',
          createdAt: new Date(new Date(submission.submittedAt).getTime() + 90000).toISOString(), // 1.5 min later
          meta: {},
        });
      }
    });

    this.saveAuditEvents(initialEvents);
    console.log(`[DemoStore] Seeded ${initialEvents.length} audit events`);
  }

  // ========== Assignment Methods ==========

  /**
   * Assign a work queue item to a user
   */
  assignWorkQueueItem(
    caseId: string,
    assignedTo: AssignedUser,
    actorName: string = 'Admin'
  ): WorkQueueItem | null {
    const item = this.updateWorkQueueItem(caseId, {
      assignedTo,
      assignedAt: new Date().toISOString(),
    });

    if (item) {
      // Add audit event
      this.addAuditEvent({
        caseId,
        submissionId: item.submissionId || '',
        actorRole: 'admin',
        actorName,
        action: 'ASSIGNED',
        message: `Assigned to ${assignedTo.name}`,
        meta: {
          assigneeId: assignedTo.id,
          assigneeName: assignedTo.name,
        },
      });
    }

    return item;
  }

  /**
   * Unassign a work queue item
   */
  unassignWorkQueueItem(
    caseId: string,
    actorName: string = 'Admin'
  ): WorkQueueItem | null {
    const items = this.getWorkQueue();
    const item = items.find((i) => i.id === caseId);
    
    if (!item) {
      console.warn(`[DemoStore] Work queue item not found: ${caseId}`);
      return null;
    }

    const previousAssignee = item.assignedTo;

    const updated = this.updateWorkQueueItem(caseId, {
      assignedTo: null,
      assignedAt: null,
    });

    if (updated && previousAssignee) {
      // Add audit event
      this.addAuditEvent({
        caseId,
        submissionId: item.submissionId || '',
        actorRole: 'admin',
        actorName,
        action: 'UNASSIGNED',
        message: `Unassigned from ${previousAssignee.name}`,
        meta: {
          previousAssigneeId: previousAssignee.id,
          previousAssigneeName: previousAssignee.name,
        },
      });
    }

    return updated;
  }

  /**
   * Get work queue items assigned to a specific user
   */
  getWorkQueueByAssignee(userId: string): WorkQueueItem[] {
    const items = this.getWorkQueue();
    return items.filter((item) => item.assignedTo?.id === userId);
  }

  /**
   * Get unassigned work queue items
   */
  getUnassignedWorkQueue(): WorkQueueItem[] {
    const items = this.getWorkQueue();
    return items.filter((item) => !item.assignedTo);
  }
}

// Export singleton instance
export const demoStore = new DemoStore();
