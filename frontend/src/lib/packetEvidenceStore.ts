/**
 * Packet Evidence Selection Store
 * 
 * Manages which evidence items are included in export packets.
 * Step 2.5: Evidence Drilldown Drawer + Packet Inclusion Controls
 */

const STORAGE_KEY = 'acai.packetEvidenceSelection.v1';

interface PacketEvidenceSelection {
  [caseId: string]: {
    includedEvidenceIds: string[];
  };
}

class PacketEvidenceStore {
  private getSelections(): PacketEvidenceSelection {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return {};
      return JSON.parse(data);
    } catch (err) {
      console.error('[PacketEvidenceStore] Failed to read selections:', err);
      return {};
    }
  }

  private saveSelections(selections: PacketEvidenceSelection): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
    } catch (err) {
      console.error('[PacketEvidenceStore] Failed to save selections:', err);
    }
  }

  getIncludedEvidenceIds(caseId: string): string[] {
    const selections = this.getSelections();
    return selections[caseId]?.includedEvidenceIds || [];
  }

  setIncludedEvidenceIds(caseId: string, evidenceIds: string[]): void {
    const selections = this.getSelections();
    selections[caseId] = { includedEvidenceIds: evidenceIds };
    this.saveSelections(selections);
  }

  toggleEvidenceIncluded(caseId: string, evidenceId: string): boolean {
    const selections = this.getSelections();
    const current = selections[caseId]?.includedEvidenceIds || [];
    
    let newIncluded: string[];
    if (current.includes(evidenceId)) {
      newIncluded = current.filter(id => id !== evidenceId);
    } else {
      newIncluded = [...current, evidenceId];
    }
    
    selections[caseId] = { includedEvidenceIds: newIncluded };
    this.saveSelections(selections);
    
    return newIncluded.includes(evidenceId);
  }

  isEvidenceIncluded(caseId: string, evidenceId: string, allEvidenceIds: string[] = []): boolean {
    const selections = this.getSelections();
    const included = selections[caseId]?.includedEvidenceIds;
    
    // Default behavior: if no selection exists, include all evidence
    if (!included || included.length === 0) {
      return true;
    }
    
    return included.includes(evidenceId);
  }

  initializeForCase(caseId: string, allEvidenceIds: string[]): void {
    const selections = this.getSelections();
    
    // Only initialize if not already set
    if (!selections[caseId]) {
      selections[caseId] = { includedEvidenceIds: allEvidenceIds };
      this.saveSelections(selections);
    }
  }

  clearSelectionForCase(caseId: string): void {
    const selections = this.getSelections();
    delete selections[caseId];
    this.saveSelections(selections);
  }
}

// Export singleton instance
export const packetEvidenceStore = new PacketEvidenceStore();
