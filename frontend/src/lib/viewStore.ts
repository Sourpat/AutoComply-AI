/**
 * View Store - localStorage-backed saved queue views
 * 
 * Provides persistence for saved queue views (filters, search, sort).
 * Step 2.3: Queue Search + Saved Views + Shareable URLs
 */

import type { QueueView, QueueViewCreateInput } from '../types/views';

const STORAGE_KEY = 'acai.queueViews.v1';

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

class ViewStore {
  listViews(): QueueView[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (err) {
      console.error('[ViewStore] Failed to read views:', err);
      return [];
    }
  }

  saveView(input: QueueViewCreateInput): QueueView {
    const views = this.listViews();
    
    const now = new Date().toISOString();
    const newView: QueueView = {
      id: generateId(),
      name: input.name,
      query: input.query || '',
      filters: input.filters || {},
      sort: input.sort || { field: 'overdue', direction: 'desc' },
      isDefault: input.isDefault || false,
      createdAt: now,
      updatedAt: now,
    };

    // If marking as default, unmark all others
    if (newView.isDefault) {
      views.forEach((v) => (v.isDefault = false));
    }

    views.push(newView);
    this.saveViews(views);
    return newView;
  }

  updateView(id: string, updates: Partial<QueueViewCreateInput>): QueueView | null {
    const views = this.listViews();
    const index = views.findIndex((v) => v.id === id);
    if (index === -1) return null;

    const updated: QueueView = {
      ...views[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // If marking as default, unmark all others
    if (updated.isDefault) {
      views.forEach((v, i) => {
        if (i !== index) v.isDefault = false;
      });
    }

    views[index] = updated;
    this.saveViews(views);
    return updated;
  }

  deleteView(id: string): boolean {
    const views = this.listViews();
    const filtered = views.filter((v) => v.id !== id);
    if (filtered.length === views.length) return false; // Not found
    this.saveViews(filtered);
    return true;
  }

  setDefaultView(id: string): boolean {
    const views = this.listViews();
    const view = views.find((v) => v.id === id);
    if (!view) return false;

    // Unmark all as default
    views.forEach((v) => (v.isDefault = false));
    // Mark this one as default
    view.isDefault = true;
    this.saveViews(views);
    return true;
  }

  getDefaultView(): QueueView | null {
    const views = this.listViews();
    return views.find((v) => v.isDefault) || null;
  }

  private saveViews(views: QueueView[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
    } catch (err) {
      console.error('[ViewStore] Failed to save views:', err);
    }
  }
}

// Export singleton instance
export const viewStore = new ViewStore();
