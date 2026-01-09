/**
 * Decision Packet Builder Utility
 * 
 * Converts various input formats (trace, explainability response, queue item)
 * into a normalized DecisionPacket for export
 */

import type { DecisionPacket } from '../types/decisionPacket';
import type { NormalizedTrace } from '../lib/traceNormalizer';
import type { Submission } from '../types/workQueue';
import { packetEvidenceStore } from '../lib/packetEvidenceStore';

interface PacketBuilderInput {
  // Source data (one of these required)
  trace?: any;
  normalizedTrace?: NormalizedTrace;
  submission?: Submission;
  explainResponse?: any;
  
  // Additional context
  tenant?: string;
  scenarioName?: string;
  sourceType?: 'trace' | 'explainability' | 'queue_item' | 'sandbox' | 'connected_mode' | 'sandbox_mode' | 'work_queue' | 'recent_decision' | 'rag_explorer';
  caseId?: string; // For evidence selection
}

/**
 * Build a complete decision packet from various input sources
 */
export function buildDecisionPacket(input: PacketBuilderInput): DecisionPacket {
  const now = new Date().toISOString();
  
  // Extract normalized trace if available
  const trace = input.normalizedTrace || input.trace;
  const submission = input.submission;
  const explainResponse = input.explainResponse;
  
  // Extract decision info
  const status = trace?.outcome || submission?.status || 'unknown';
  const risk = trace?.risk_level || explainResponse?.debug?.risk_level;
  const summary = trace?.decision_summary || explainResponse?.answer;
  
  // Extract entity info from submission payload or trace
  const payload = submission?.payload || trace?.payload || explainResponse?.evidence || {};
  
  const entities = extractEntities(payload);
  
  // Extract fired rules
  const firedRules = extractFiredRules(trace, explainResponse);
  
  // Extract evidence
  const allEvidence = extractEvidence(trace, explainResponse, firedRules);
  
  // Filter evidence by inclusion if caseId is provided
  const evidence = input.caseId 
    ? filterEvidenceByInclusion(allEvidence, input.caseId)
    : allEvidence;
  
  // Extract next steps
  const nextSteps = extractNextSteps(trace, explainResponse, firedRules);
  
  // Build packet
  const packet: DecisionPacket = {
    packetVersion: '1.0.0',
    generatedAt: now,
    tenant: input.tenant || payload.tenantId || 'demo',
    
    decision: {
      status: normalizeStatus(status),
      risk: risk as any,
      csfType: submission?.csfType || submission?.kind || payload.csfType,
      scenarioName: input.scenarioName,
      submissionId: submission?.id,
      traceId: submission?.traceId || trace?.trace_id || trace?.traceId,
      outcome: trace?.outcome,
      summary: summary || undefined
    },
    
    entities,
    firedRules,
    evidence,
    nextSteps,
    
    traceMeta: {
      runId: trace?.run_id || trace?.runId,
      modelVersion: trace?.model_version || trace?.modelVersion,
      evaluatorVersion: trace?.evaluator_version || trace?.evaluatorVersion,
      environment: 'demo',
      sourceType: input.sourceType || 'trace'
    }
  };
  
  return packet;
}

function normalizeStatus(status: any): DecisionPacket['decision']['status'] {
  const str = String(status).toLowerCase();
  if (str.includes('approv')) return 'approved';
  if (str.includes('block')) return 'blocked';
  if (str.includes('review')) return 'needs_review';
  if (str.includes('submit')) return 'submitted';
  return 'unknown';
}

function extractEntities(payload: any) {
  const entities: DecisionPacket['entities'] = {
    missingFields: []
  };
  
  // Extract facility info
  if (payload.facility_name || payload.facility_type) {
    entities.facility = {
      name: payload.facility_name,
      type: payload.facility_type,
      state: payload.state,
      deaNumber: payload.dea_number,
      tdddCertificate: payload.tddd_certificate_number
    };
  }
  
  // Extract practitioner info
  if (payload.practitioner_name || payload.npi) {
    entities.practitioner = {
      name: payload.practitioner_name,
      deaNumber: payload.dea_number,
      state: payload.state,
      stateLicenseNumber: payload.state_license_number,
      npi: payload.npi
    };
  }
  
  // Extract pharmacy info
  if (payload.pharmacy_name) {
    entities.pharmacy = {
      name: payload.pharmacy_name,
      state: payload.state,
      licenseNumber: payload.pharmacy_license_number
    };
  }
  
  // Extract licenses
  if (payload.state_license_number || payload.state_license_expiration) {
    entities.licenses = [{
      type: 'State Medical License',
      number: payload.state_license_number || 'N/A',
      state: payload.state || 'N/A',
      expiration: payload.state_license_expiration,
      status: payload.state_license_status
    }];
  }
  
  return entities;
}

function extractFiredRules(trace: any, explainResponse: any): DecisionPacket['firedRules'] {
  const rules: DecisionPacket['firedRules'] = [];
  
  // From trace
  if (trace?.fired_rules) {
    trace.fired_rules.forEach((rule: any) => {
      rules.push({
        ruleId: rule.id || rule.ruleId || 'unknown',
        title: rule.title || rule.name || 'Unnamed Rule',
        severity: rule.severity || 'info',
        jurisdiction: rule.jurisdiction,
        citation: rule.citation,
        requirement: rule.requirement,
        rationale: rule.rationale
      });
    });
  }
  
  // From explainability response
  if (explainResponse?.debug?.fired_rules) {
    explainResponse.debug.fired_rules.forEach((rule: any) => {
      // Avoid duplicates
      if (!rules.find(r => r.ruleId === (rule.id || rule.ruleId))) {
        rules.push({
          ruleId: rule.id || rule.ruleId || 'unknown',
          title: rule.title || rule.name || 'Unnamed Rule',
          severity: rule.severity || 'info',
          jurisdiction: rule.jurisdiction,
          citation: rule.citation,
          requirement: rule.requirement,
          rationale: rule.rationale
        });
      }
    });
  }
  
  return rules;
}

function extractEvidence(trace: any, explainResponse: any, firedRules: DecisionPacket['firedRules']): DecisionPacket['evidence'] {
  const evidenceMap = new Map<string, DecisionPacket['evidence'][0]>();
  
  // From fired rules (evidence chips)
  firedRules.forEach(rule => {
    const ruleData = trace?.fired_rules?.find((r: any) => r.id === rule.ruleId) ||
                     explainResponse?.debug?.fired_rules?.find((r: any) => r.id === rule.ruleId);
    
    if (ruleData?.evidence) {
      ruleData.evidence.forEach((ev: any) => {
        const key = `${ev.docTitle}_${ev.snippet?.substring(0, 50)}`;
        if (!evidenceMap.has(key)) {
          evidenceMap.set(key, {
            docId: ev.docId,
            docTitle: ev.docTitle,
            jurisdiction: ev.jurisdiction,
            section: ev.section,
            snippet: ev.snippet,
            score: ev.score,
            sourceUrl: ev.sourceUrl
          });
        }
      });
    }
  });
  
  // From trace evidence array
  if (trace?.evidence) {
    trace.evidence.forEach((ev: any) => {
      const key = `${ev.docTitle || ev.doc_title}_${ev.snippet?.substring(0, 50)}`;
      if (!evidenceMap.has(key)) {
        evidenceMap.set(key, {
          docId: ev.docId || ev.doc_id,
          docTitle: ev.docTitle || ev.doc_title || 'Unnamed Document',
          jurisdiction: ev.jurisdiction,
          section: ev.section,
          snippet: ev.snippet,
          score: ev.score,
          sourceUrl: ev.sourceUrl || ev.source_url
        });
      }
    });
  }
  
  // From explainability sources
  if (explainResponse?.debug?.sources) {
    explainResponse.debug.sources.slice(0, 10).forEach((src: any) => {
      const key = `${src.label}_${src.snippet?.substring(0, 50)}`;
      if (!evidenceMap.has(key)) {
        evidenceMap.set(key, {
          docId: src.id,
          docTitle: src.label || src.citation || 'Regulatory Source',
          jurisdiction: src.jurisdiction,
          section: src.citation,
          snippet: src.snippet,
          score: src.score,
          sourceUrl: src.url
        });
      }
    });
  }
  
  // Return top 10, sorted by score if available
  return Array.from(evidenceMap.values())
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 10);
}

function extractNextSteps(trace: any, explainResponse: any, firedRules: DecisionPacket['firedRules']): string[] {
  const steps: string[] = [];
  
  // From trace
  if (trace?.next_steps && Array.isArray(trace.next_steps)) {
    steps.push(...trace.next_steps);
  }
  
  // From explainability
  if (explainResponse?.debug?.next_steps && Array.isArray(explainResponse.debug.next_steps)) {
    explainResponse.debug.next_steps.forEach((step: string) => {
      if (!steps.includes(step)) {
        steps.push(step);
      }
    });
  }
  
  // Default steps if none provided
  if (steps.length === 0) {
    if (firedRules.length === 0) {
      steps.push(
        'No regulatory rules were triggered by this submission.',
        'This decision likely auto-cleared or lacks sufficient data for evaluation.',
        'Review submission completeness and re-run if needed.',
        'Consult with compliance officer if uncertainty remains.'
      );
    } else {
      steps.push(
        'Review fired rules and address missing evidence.',
        'Consult with compliance officer for next steps.',
        'Resubmit after addressing all issues.'
      );
    }
  }
  
  return steps;
}

/**
 * Filter evidence by inclusion state from packetEvidenceStore
 */
function filterEvidenceByInclusion(
  evidence: DecisionPacket['evidence'], 
  caseId: string
): DecisionPacket['evidence'] {
  const includedIds = packetEvidenceStore.getIncludedEvidenceIds(caseId);
  
  // If no explicit selection exists, include all (default behavior)
  if (includedIds.length === 0) {
    return evidence;
  }
  
  // Filter to only included evidence
  return evidence.filter(ev => {
    const evidenceId = ev.docId ?? `${ev.docTitle}_${ev.snippet?.substring(0, 50)}`;
    return includedIds.includes(evidenceId);
  });
}
