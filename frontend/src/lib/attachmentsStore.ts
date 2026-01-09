/**
 * Attachments Store - localStorage-backed case attachments (demo stub)
 * 
 * Provides persistence for demo attachment metadata.
 * Step 2.4: Case Details Workspace
 */

export interface CaseAttachment {
  id: string;
  caseId: string;
  filename: string;
  createdAt: string;
  uploadedBy: string;
}

const STORAGE_KEY = 'acai.attachments.v1';

// Simple UUID fallback for environments without crypto.randomUUID
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class AttachmentsStore {
  getAllAttachments(): CaseAttachment[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (err) {
      console.error('[AttachmentsStore] Failed to read attachments:', err);
      return [];
    }
  }

  getAttachmentsByCaseId(caseId: string): CaseAttachment[] {
    const allAttachments = this.getAllAttachments();
    return allAttachments
      .filter((att) => att.caseId === caseId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Newest first
  }

  addAttachment(caseId: string, filename: string, uploadedBy: string): CaseAttachment {
    const attachments = this.getAllAttachments();
    
    const newAttachment: CaseAttachment = {
      id: generateId(),
      caseId,
      filename,
      uploadedBy,
      createdAt: new Date().toISOString(),
    };

    attachments.push(newAttachment);
    this.saveAttachments(attachments);
    return newAttachment;
  }

  deleteAttachment(attachmentId: string): boolean {
    const attachments = this.getAllAttachments();
    const filtered = attachments.filter((a) => a.id !== attachmentId);
    if (filtered.length === attachments.length) return false; // Not found
    this.saveAttachments(filtered);
    return true;
  }

  private saveAttachments(attachments: CaseAttachment[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(attachments));
    } catch (err) {
      console.error('[AttachmentsStore] Failed to save attachments:', err);
    }
  }
}

// Export singleton instance
export const attachmentsStore = new AttachmentsStore();
