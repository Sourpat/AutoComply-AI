/**
 * Decision Packet Type Definition
 * 
 * Normalized structure for exporting audit-ready decision data
 * from various sources (work queue, trace, explainability response)
 */

export interface DecisionPacket {
  packetVersion: string;
  generatedAt: string; // ISO timestamp
  tenant: string | null;
  
  decision: {
    status: 'approved' | 'blocked' | 'needs_review' | 'submitted' | 'unknown';
    risk?: 'Low' | 'Medium' | 'High';
    csfType?: string | null;
    scenarioName?: string | null;
    submissionId?: string | null;
    traceId?: string | null;
    outcome?: string;
    summary?: string;
  };
  
  entities: {
    facility?: {
      name?: string;
      type?: string;
      state?: string;
      deaNumber?: string;
      tdddCertificate?: string;
    } | null;
    practitioner?: {
      name?: string;
      deaNumber?: string;
      state?: string;
      stateLicenseNumber?: string;
      npi?: string;
    } | null;
    pharmacy?: {
      name?: string;
      state?: string;
      licenseNumber?: string;
    } | null;
    licenses?: Array<{
      type: string;
      number: string;
      state: string;
      expiration?: string;
      status?: string;
    }>;
    missingFields?: string[];
  };
  
  firedRules: Array<{
    ruleId: string;
    title: string;
    severity: 'block' | 'review' | 'info';
    jurisdiction?: string;
    citation?: string;
    requirement?: string;
    rationale?: string;
  }>;
  
  evidence: Array<{
    docId?: string;
    docTitle: string;
    jurisdiction?: string;
    section?: string;
    snippet?: string;
    score?: number;
    sourceUrl?: string;
  }>;
  
  nextSteps: string[];
  
  traceMeta: {
    runId?: string;
    modelVersion?: string;
    evaluatorVersion?: string;
    environment?: string;
    sourceType?: 'trace' | 'explainability' | 'queue_item' | 'sandbox' | 'connected_mode' | 'sandbox_mode' | 'work_queue' | 'recent_decision' | 'rag_explorer';
  };
}
