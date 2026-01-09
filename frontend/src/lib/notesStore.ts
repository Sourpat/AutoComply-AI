/**
 * Notes Store - localStorage-backed case notes
 * 
 * Provides persistence for internal case notes (reviewer comments).
 * Step 2.4: Case Details Workspace
 */

export interface CaseNote {
  id: string;
  caseId: string;
  authorRole: string;
  authorName: string;
  body: string;
  createdAt: string;
}

const STORAGE_KEY = 'acai.caseNotes.v1';

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

class NotesStore {
  getAllNotes(): CaseNote[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (err) {
      console.error('[NotesStore] Failed to read notes:', err);
      return [];
    }
  }

  getNotesByCaseId(caseId: string): CaseNote[] {
    const allNotes = this.getAllNotes();
    return allNotes
      .filter((note) => note.caseId === caseId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Newest first
  }

  addNote(caseId: string, body: string, authorName: string, authorRole: string): CaseNote {
    const notes = this.getAllNotes();
    
    const newNote: CaseNote = {
      id: generateId(),
      caseId,
      authorRole,
      authorName,
      body,
      createdAt: new Date().toISOString(),
    };

    notes.push(newNote);
    this.saveNotes(notes);
    return newNote;
  }

  deleteNote(noteId: string): boolean {
    const notes = this.getAllNotes();
    const filtered = notes.filter((n) => n.id !== noteId);
    if (filtered.length === notes.length) return false; // Not found
    this.saveNotes(filtered);
    return true;
  }

  private saveNotes(notes: CaseNote[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (err) {
      console.error('[NotesStore] Failed to save notes:', err);
    }
  }
}

// Export singleton instance
export const notesStore = new NotesStore();
