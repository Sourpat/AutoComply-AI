/**
 * Coverage Service
 * 
 * Calculates implementation coverage and identifies gaps for each decision type.
 * Compares actual implementation signals against coverage targets.
 * 
 * Step 2.7: Coverage & Gaps Dashboard
 * Step 2.15: Updated to derive real counts from playbook registry and regulatory seed data
 */

import type { DecisionTypeKey, CoverageTarget } from './coverageRegistry';
import { getCoverageTarget, coverageTargets } from './coverageRegistry';
import { getPlaybookStepCount, hasPlaybook } from '../playbooks';

/**
 * Regulatory seed metadata - mirrors backend seed data structure.
 * Counts derived from actual seed files:
 * - backend/src/autocomply/regulations/csf_practitioner_seed.py
 * - backend/src/autocomply/regulations/ohio_tddd_seed.py
 * - backend/src/autocomply/regulations/ny_pharmacy_license_seed.py
 * - backend/src/autocomply/regulations/csf_facility_seed.py
 */
interface RegulatoryMetadata {
  rulesCount: number;        // Number of rules in seed dataset
  evidenceSourcesCount: number;  // Number of evidence sources in seed dataset
  evidenceTagsPresent: string[]; // Tags present in seed dataset
}

const REGULATORY_METADATA: Record<DecisionTypeKey, RegulatoryMetadata> = {
  csf_practitioner: {
    rulesCount: 12,  // csf_practitioner_seed.py: 12 rules (3 block, 4 review, 5 info)
    evidenceSourcesCount: 6,  // csf_practitioner_seed.py: 6 evidence sources
    evidenceTagsPresent: [
      'dea',
      'registration',
      'federal',
      'state_license',
      'controlled-substances',
      'practitioner',
      'csf',
      'attestation',
    ],
  },
  ohio_tddd: {
    rulesCount: 10,  // ohio_tddd_seed.py: 10 rules (3 block, 3 review, 4 info)
    evidenceSourcesCount: 6,  // ohio_tddd_seed.py: 6 evidence sources
    evidenceTagsPresent: [
      'ohio',
      'tddd',
      'pharmacy',
      'terminal-distributor',
      'controlled-substances',
      'license',
      'expiry',
    ],
  },
  ny_pharmacy_license: {
    rulesCount: 14,  // ny_pharmacy_license_seed.py: 14 rules (4 block, 5 review, 5 info)
    evidenceSourcesCount: 7,  // ny_pharmacy_license_seed.py: 7 evidence sources
    evidenceTagsPresent: [
      'new-york',
      'pharmacy',
      'license',
      'controlled-substances',
      'bne',
      'nysdoh',
      'istop',
      'triennial',
    ],
  },
  csf_facility: {
    rulesCount: 15,  // csf_facility_seed.py: 15 rules (5 block, 5 review, 5 info)
    evidenceSourcesCount: 8,  // csf_facility_seed.py: 8 evidence sources
    evidenceTagsPresent: [
      'hospital',
      'facility',
      'csf',
      'dea',
      'controlled-substances',
      'storage',
      'security',
      'diversion',
      'recordkeeping',
    ],
  },
};

export type GapSeverity = 'high' | 'medium' | 'low';

export interface CoverageSignals {
  rulesCount: number;
  evidenceSourcesCount: number;
  evidenceTagsPresent: string[];
  playbookStepCount: number;
}

export interface CoverageGap {
  id: string;
  severity: GapSeverity;
  category: string;
  description: string;
  impact: string;
  recommendation: string;
}

export interface CoverageResult {
  decisionType: DecisionTypeKey;
  label: string;
  description: string;
  signals: CoverageSignals;
  coverage: {
    rulesPct: number;
    evidencePct: number;
    tagsPct: number;
    playbookPct: number;
    evaluatorPct: number;
    overallPct: number;
  };
  gaps: CoverageGap[];
  capabilities: {
    evaluatorImplemented: boolean;
    playbookImplemented: boolean;
    ragSearchAvailable: boolean;
    ragExplainAvailable: boolean;
  };
}

/**
 * Get real coverage signals for each decision type.
 * 
 * Derives counts from:
 * - rulesCount: Regulatory seed datasets (REGULATORY_METADATA)
 * - evidenceSourcesCount: Regulatory seed datasets (REGULATORY_METADATA)
 * - evidenceTagsPresent: Regulatory seed datasets (REGULATORY_METADATA)
 * - playbookStepCount: Playbook registry (imported from ../playbooks)
 */
function getCoverageSignals(decisionType: DecisionTypeKey): CoverageSignals {
  const metadata = REGULATORY_METADATA[decisionType];
  
  if (!metadata) {
    return {
      rulesCount: 0,
      evidenceSourcesCount: 0,
      evidenceTagsPresent: [],
      playbookStepCount: 0,
    };
  }
  
  return {
    rulesCount: metadata.rulesCount,
    evidenceSourcesCount: metadata.evidenceSourcesCount,
    evidenceTagsPresent: metadata.evidenceTagsPresent,
    playbookStepCount: getPlaybookStepCount(decisionType),
  };
}

/**
 * Calculate coverage percentage safely
 */
function calculateCoveragePct(actual: number, target: number): number {
  if (target === 0) return 100;
  const pct = (actual / target) * 100;
  return Math.min(100, Math.round(pct));
}

/**
 * Calculate tag coverage percentage
 */
function calculateTagCoveragePct(actualTags: string[], expectedTags: string[]): number {
  if (expectedTags.length === 0) return 100;
  
  const matchingTags = expectedTags.filter(tag =>
    actualTags.some(actualTag =>
      actualTag.toLowerCase().includes(tag.toLowerCase()) ||
      tag.toLowerCase().includes(actualTag.toLowerCase())
    )
  );
  
  return Math.round((matchingTags.length / expectedTags.length) * 100);
}

/**
 * Generate coverage gaps based on signals vs targets
 */
function generateGaps(
  decisionType: DecisionTypeKey,
  signals: CoverageSignals,
  target: CoverageTarget,
  coveragePcts: CoverageResult['coverage']
): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  
  // Rules gap
  if (signals.rulesCount < target.targets.expectedRules) {
    const missing = target.targets.expectedRules - signals.rulesCount;
    const severity: GapSeverity = 
      signals.rulesCount === 0 ? 'high' :
      coveragePcts.rulesPct < 50 ? 'high' :
      coveragePcts.rulesPct < 80 ? 'medium' : 'low';
    
    gaps.push({
      id: `${decisionType}_rules_gap`,
      severity,
      category: 'Rules & Logic',
      description: `${missing} rules missing (${signals.rulesCount}/${target.targets.expectedRules} implemented)`,
      impact: severity === 'high' 
        ? 'Cannot make automated decisions without rule coverage'
        : 'Reduced decision quality and consistency',
      recommendation: 'Implement missing decision rules in evaluator engine',
    });
  }
  
  // Evidence sources gap
  if (signals.evidenceSourcesCount < target.targets.expectedEvidenceSources) {
    const missing = target.targets.expectedEvidenceSources - signals.evidenceSourcesCount;
    const severity: GapSeverity = 
      coveragePcts.evidencePct < 50 ? 'high' :
      coveragePcts.evidencePct < 80 ? 'medium' : 'low';
    
    gaps.push({
      id: `${decisionType}_evidence_gap`,
      severity,
      category: 'Evidence Sources',
      description: `${missing} evidence sources missing (${signals.evidenceSourcesCount}/${target.targets.expectedEvidenceSources} available)`,
      impact: 'Limited regulatory context for decisions',
      recommendation: 'Add missing regulatory documents to knowledge base',
    });
  }
  
  // Evidence tags gap
  const missingTags = target.targets.expectedEvidenceTags.filter(tag =>
    !signals.evidenceTagsPresent.some(actualTag =>
      actualTag.toLowerCase().includes(tag.toLowerCase()) ||
      tag.toLowerCase().includes(actualTag.toLowerCase())
    )
  );
  
  if (missingTags.length > 0) {
    const severity: GapSeverity = 
      coveragePcts.tagsPct < 60 ? 'high' :
      coveragePcts.tagsPct < 85 ? 'medium' : 'low';
    
    gaps.push({
      id: `${decisionType}_tags_gap`,
      severity,
      category: 'Evidence Tagging',
      description: `${missingTags.length} evidence tags missing: ${missingTags.slice(0, 3).join(', ')}`,
      impact: 'Reduced search precision and evidence mapping',
      recommendation: 'Tag existing evidence with missing categories',
    });
  }
  
  // Playbook gap
  if (!target.capabilities.playbookImplemented || signals.playbookStepCount === 0) {
    gaps.push({
      id: `${decisionType}_playbook_gap`,
      severity: 'medium',
      category: 'Reviewer Playbook',
      description: 'No playbook available for this decision type',
      impact: 'Inconsistent manual reviews, longer training time',
      recommendation: 'Create reviewer playbook with step-by-step checklist',
    });
  }
  
  // Evaluator gap
  if (!target.capabilities.evaluatorImplemented) {
    gaps.push({
      id: `${decisionType}_evaluator_gap`,
      severity: 'high',
      category: 'Decision Evaluator',
      description: 'No automated evaluator implemented',
      impact: 'All decisions require full manual review',
      recommendation: 'Implement evaluator engine for this decision type',
    });
  }
  
  // RAG explain gap
  if (!target.capabilities.ragExplainAvailable) {
    gaps.push({
      id: `${decisionType}_rag_explain_gap`,
      severity: 'low',
      category: 'RAG Explainability',
      description: 'RAG explain endpoint not configured',
      impact: 'Limited explainability for regulatory context',
      recommendation: 'Configure RAG explain endpoint with decision scenarios',
    });
  }
  
  return gaps;
}

/**
 * Build coverage results for all decision types
 */
export function buildCoverageResults(): CoverageResult[] {
  return coverageTargets.map(target => {
    const signals = getCoverageSignals(target.decisionType);
    
    // Calculate individual coverage percentages
    const rulesPct = calculateCoveragePct(signals.rulesCount, target.targets.expectedRules);
    const evidencePct = calculateCoveragePct(signals.evidenceSourcesCount, target.targets.expectedEvidenceSources);
    const tagsPct = calculateTagCoveragePct(signals.evidenceTagsPresent, target.targets.expectedEvidenceTags);
    const playbookPct = target.capabilities.playbookImplemented ? 100 : 0;
    const evaluatorPct = target.capabilities.evaluatorImplemented ? 100 : 0;
    
    // Calculate overall coverage (weighted average)
    const overallPct = Math.round(
      (rulesPct * 0.25) +      // 25% weight on rules
      (evidencePct * 0.20) +   // 20% weight on evidence sources
      (tagsPct * 0.15) +       // 15% weight on tags
      (playbookPct * 0.20) +   // 20% weight on playbook
      (evaluatorPct * 0.20)    // 20% weight on evaluator
    );
    
    const coverage = {
      rulesPct,
      evidencePct,
      tagsPct,
      playbookPct,
      evaluatorPct,
      overallPct,
    };
    
    // Generate gaps
    const gaps = generateGaps(target.decisionType, signals, target, coverage);
    
    return {
      decisionType: target.decisionType,
      label: target.label,
      description: target.description,
      signals,
      coverage,
      gaps,
      capabilities: target.capabilities,
    };
  });
}

/**
 * Get coverage result for a specific decision type
 */
export function getCoverageResult(decisionType: DecisionTypeKey): CoverageResult | null {
  const results = buildCoverageResults();
  return results.find(r => r.decisionType === decisionType) || null;
}

/**
 * Get high-severity gaps across all decision types
 */
export function getHighSeverityGaps(): Array<CoverageGap & { decisionType: DecisionTypeKey }> {
  const results = buildCoverageResults();
  const highGaps: Array<CoverageGap & { decisionType: DecisionTypeKey }> = [];
  
  results.forEach(result => {
    result.gaps
      .filter(gap => gap.severity === 'high')
      .forEach(gap => {
        highGaps.push({ ...gap, decisionType: result.decisionType });
      });
  });
  
  return highGaps;
}

/**
 * Get coverage summary statistics
 */
export function getCoverageSummary() {
  const results = buildCoverageResults();
  
  return {
    totalDecisionTypes: results.length,
    fullyImplemented: results.filter(r => r.coverage.overallPct === 100).length,
    partiallyImplemented: results.filter(r => r.coverage.overallPct > 0 && r.coverage.overallPct < 100).length,
    notImplemented: results.filter(r => r.coverage.overallPct === 0).length,
    averageCoverage: Math.round(
      results.reduce((sum, r) => sum + r.coverage.overallPct, 0) / results.length
    ),
    totalGaps: results.reduce((sum, r) => sum + r.gaps.length, 0),
    highSeverityGaps: results.reduce((sum, r) => sum + r.gaps.filter(g => g.severity === 'high').length, 0),
  };
}
