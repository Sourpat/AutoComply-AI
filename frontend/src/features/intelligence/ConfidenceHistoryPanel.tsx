import React, { useState, useEffect } from "react";
import { getIntelligenceHistory } from "../../api/intelligenceApi";
import type { IntelligenceHistoryEntry } from "../../api/intelligenceApi";
import { API_BASE } from "../../lib/api";

interface ConfidenceHistoryPanelProps {
  caseId: string;
  limit?: number;
  role?: string; // Phase 7.22: Role for export gating
}

// Phase 7.22: Audit export types
interface AuditExportResponse {
  metadata: {
    case_id: string;
    export_timestamp: string;
    total_entries: number;
    include_payload: boolean;
    format_version: string;
  };
  integrity_check: {
    is_valid: boolean;
    broken_links: Array<{ entry_id: string; missing_previous_id: string }>;
    orphaned_entries: string[];
    total_entries: number;
    verified_entries: number;
  };
  duplicate_analysis: {
    duplicates: Array<{
      input_hash: string;
      count: number;
      entry_ids: string[];
      timestamps: string[];
    }>;
    total_unique_hashes: number;
    total_entries: number;
    has_duplicates: boolean;
  };
  history: Array<{
    id: string;
    computed_at: string;
    confidence_score?: number;
    confidence_band?: string;
    rules_passed?: number;
    rules_total?: number;
    gap_count?: number;
    bias_count?: number;
    previous_run_id?: string | null;
    triggered_by?: string | null;
    input_hash?: string | null;
    payload?: any;
  }>;
  // Phase 7.26: Signature metadata
  signature?: {
    alg: string;
    key_id: string;
    value: string;
    signed_at: string;
  };
  canonicalization?: {
    json: string;
    exclude_fields: string[];
  };
}

// Phase 7.24: Evidence snapshot types
interface EvidenceSnapshotResponse {
  run_id: string;
  case_id: string;
  computed_at: string;
  evidence_version?: string;
  evidence_hash?: string;
  evidence_snapshot: {
    snapshot_at: string;
    case: {
      status?: string;
      decision_type?: string;
      created_at?: string;
      updated_at?: string;
    };
    submission: {
      fields: Record<string, { present: boolean; type: string; length: number }>;
      submitted_at?: string;
      field_count: number;
    } | null;
    attachments: Array<{
      id: string;
      filename: string;
      mime_type: string;
      size_bytes: number;
      uploaded_at: string;
      category?: string;
    }>;
    request_info_responses: number;
  };
}

/**
 * ConfidenceHistoryPanel Component (Phase 7.17, updated 7.22, 7.23, 7.24)
 * 
 * Displays a timeline of intelligence computation history for a case.
 * Shows what changed over time and what triggered each recomputation.
 * 
 * Features:
 * - Timeline of confidence changes
 * - Confidence score deltas (↑ +5% or ↓ -3%)
 * - Trigger badges (manual/submission/evidence/request_info)
 * - Expandable details (rules, gaps, bias counts)
 * - Audit export with integrity verification (Phase 7.22)
 * - Empty state when no history exists
 */
export const ConfidenceHistoryPanel: React.FC<ConfidenceHistoryPanelProps> = ({
  caseId,
  limit = 10,
  role,
}) => {
  const [history, setHistory] = useState<IntelligenceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Phase 7.22: Audit export state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [includePayload, setIncludePayload] = useState(false);
  const [lastExport, setLastExport] = useState<AuditExportResponse | null>(null);
  const [showIntegrityDetails, setShowIntegrityDetails] = useState(false);
  
  // Phase 7.23: Diff comparison state
  const [comparingEntry, setComparingEntry] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<{
    current: IntelligenceHistoryEntry;
    previous: IntelligenceHistoryEntry;
  } | null>(null);
  
  // Phase 7.24: Evidence viewing state
  const [viewingEvidence, setViewingEvidence] = useState<string | null>(null);
  const [evidenceData, setEvidenceData] = useState<EvidenceSnapshotResponse | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getIntelligenceHistory(caseId, limit);
        setHistory(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load history';
        setError(message);
        console.error('[ConfidenceHistoryPanel] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [caseId, limit]);

  // Phase 7.22: Export audit trail
  const handleExportAudit = async () => {
    setExporting(true);
    setExportError(null);

    try {
      const url = `${API_BASE}/workflow/cases/${caseId}/audit/export?include_payload=${includePayload}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status} ${response.statusText}`);
      }

      const data: AuditExportResponse = await response.json();
      setLastExport(data);

      // Download as JSON file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `autocomply_audit_${caseId}_${timestamp}.json`;
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      // Show warning if integrity check failed
      if (!data.integrity_check.is_valid) {
        setExportError(`Integrity check FAILED: ${data.integrity_check.broken_links.length} broken links detected`);
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      setExportError(message);
      console.error('[ConfidenceHistoryPanel] Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  // Phase 7.23: Compare to previous entry
  const handleCompare = (currentEntry: IntelligenceHistoryEntry, previousEntry: IntelligenceHistoryEntry) => {
    setDiffData({
      current: currentEntry,
      previous: previousEntry,
    });
    setComparingEntry(currentEntry.id);
  };

  // Phase 7.23: Close diff view
  const handleCloseDiff = () => {
    setDiffData(null);
    setComparingEntry(null);
  };

  // Phase 7.23: Calculate changes between entries
  const calculateDiff = (current: IntelligenceHistoryEntry, previous: IntelligenceHistoryEntry) => {
    const currentPayload = current.payload || {};
    const previousPayload = previous.payload || {};

    // Decision change
    const decisionChanged = currentPayload.decision !== previousPayload.decision;

    // Confidence change
    const confidenceDelta = current.confidence_score - previous.confidence_score;

    // Rules diff
    const currentRules = new Set(currentPayload.rules_hit || []);
    const previousRules = new Set(previousPayload.rules_hit || []);
    
    const rulesAdded = Array.from(currentRules).filter(r => !previousRules.has(r));
    const rulesRemoved = Array.from(previousRules).filter(r => !currentRules.has(r));

    // Gaps diff
    const currentGaps = currentPayload.gaps || [];
    const previousGaps = previousPayload.gaps || [];
    const gapsDelta = currentGaps.length - previousGaps.length;

    // Bias diff
    const currentBias = currentPayload.bias_flags || [];
    const previousBias = previousPayload.bias_flags || [];
    const biasDelta = currentBias.length - previousBias.length;

    // Phase 7.25: Policy version change detection
    const policyVersionChanged = current.policy_version !== previous.policy_version;

    return {
      decisionChanged,
      decision: {
        old: previousPayload.decision || 'unknown',
        new: currentPayload.decision || 'unknown',
      },
      confidenceDelta,
      confidence: {
        old: previous.confidence_score,
        new: current.confidence_score,
      },
      band: {
        old: previous.confidence_band,
        new: current.confidence_band,
      },
      rulesAdded,
      rulesRemoved,
      gapsDelta,
      gaps: {
        old: previousGaps,
        new: currentGaps,
      },
      biasDelta,
      bias: {
        old: previousBias,
        new: currentBias,
      },
      rules: {
        oldPassed: previous.rules_passed,
        newPassed: current.rules_passed,
        total: current.rules_total,
      },
      // Phase 7.25: Policy version tracking
      policyVersionChanged,
      policyVersion: {
        old: previous.policy_version || 'unknown',
        new: current.policy_version || 'unknown',
        oldHash: previous.policy_hash,
        newHash: current.policy_hash,
      },
    };
  };

  // Phase 7.24: View evidence snapshot for a run
  const handleViewEvidence = async (runId: string) => {
    setEvidenceLoading(true);
    setEvidenceError(null);
    setViewingEvidence(runId);

    try {
      const url = `${API_BASE}/workflow/cases/${caseId}/history/${runId}/evidence`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch evidence: ${response.status} ${response.statusText}`);
      }

      const data: EvidenceSnapshotResponse = await response.json();
      setEvidenceData(data);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load evidence';
      setEvidenceError(message);
      console.error('[ConfidenceHistoryPanel] Evidence fetch error:', err);
    } finally {
      setEvidenceLoading(false);
    }
  };

  // Phase 7.24: Close evidence viewer
  const handleCloseEvidence = () => {
    setViewingEvidence(null);
    setEvidenceData(null);
    setEvidenceError(null);
  };

  // Phase 7.24: Download evidence JSON
  const handleDownloadEvidence = () => {
    if (!evidenceData) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `autocomply_evidence_${evidenceData.run_id}_${timestamp}.json`;

    const blob = new Blob([JSON.stringify(evidenceData, null, 2)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  };

  // Phase 7.24: Copy evidence hash to clipboard
  const handleCopyHash = async () => {
    if (!evidenceData?.evidence_hash) return;

    try {
      await navigator.clipboard.writeText(evidenceData.evidence_hash);
      // Could add a toast notification here
    } catch (err) {
      console.error('[ConfidenceHistoryPanel] Failed to copy hash:', err);
    }
  };

  // Calculate confidence delta between entries
  const getConfidenceDelta = (current: IntelligenceHistoryEntry, previous: IntelligenceHistoryEntry | null): number | null => {
    if (!previous) return null;
    return current.confidence_score - previous.confidence_score;
  };

  // Format delta with + or - sign
  const formatDelta = (delta: number | null): string => {
    if (delta === null) return '';
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(1)}%`;
  };

  // Get trigger badge color and label
  const getTriggerInfo = (trigger: string): { color: string; label: string; icon: string } => {
    switch (trigger) {
      case 'manual':
        return { color: 'bg-blue-900/40 text-blue-300 border-blue-700/50', label: 'Manual', icon: '👤' };
      case 'submission':
        return { color: 'bg-purple-900/40 text-purple-300 border-purple-700/50', label: 'Submission', icon: '📄' };
      case 'evidence':
        return { color: 'bg-green-900/40 text-green-300 border-green-700/50', label: 'Evidence', icon: '📎' };
      case 'request_info':
        return { color: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50', label: 'Request Info', icon: '❓' };
      case 'decision':
        return { color: 'bg-orange-900/40 text-orange-300 border-orange-700/50', label: 'Decision', icon: '⚖️' };
      default:
        return { color: 'bg-zinc-900/40 text-zinc-400 border-zinc-700/50', label: 'Unknown', icon: '❔' };
    }
  };

  // Get confidence band color
  const getBandColor = (band: string): string => {
    switch (band) {
      case 'high':
        return 'text-green-400';
      case 'medium':
        return 'text-yellow-400';
      case 'low':
        return 'text-red-400';
      default:
        return 'text-zinc-400';
    }
  };

  // Format timestamp as relative time
  const getRelativeTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Loading state
  if (loading) {
    return (
      <div className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-transparent" />
          Loading confidence history...
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded border border-red-700/50 bg-red-950/20 p-3">
        <p className="text-xs text-red-300">{error}</p>
      </div>
    );
  }

  // Empty state
  if (history.length === 0) {
    return (
      <div className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
        <p className="text-xs text-zinc-500">No intelligence history yet. History will appear after the first computation.</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-zinc-800/50"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-300">Confidence History</span>
          <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
            {history.length} {history.length === 1 ? 'entry' : 'entries'}
          </span>
          {/* Phase 7.22: Integrity badge */}
          {lastExport && (
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                lastExport.integrity_check.is_valid
                  ? 'border-green-700/50 bg-green-900/40 text-green-300'
                  : 'border-red-700/50 bg-red-900/40 text-red-300'
              }`}
            >
              {lastExport.integrity_check.is_valid ? '✓ Integrity: VALID' : '✗ Integrity: BROKEN'}
            </span>
          )}
        </div>
        <span className="text-xs text-zinc-500">
          {isExpanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Phase 7.22: Audit Export Section (shown when expanded, gated by role) */}
      {isExpanded && (role === 'verifier' || role === 'devsupport' || role === 'admin') && (
        <div className="border-t border-zinc-800 bg-zinc-950/50 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={includePayload}
                  onChange={(e) => setIncludePayload(e.target.checked)}
                  className="h-3 w-3 rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-1 focus:ring-blue-500"
                />
                Include full payloads
              </label>
              <span className="text-[10px] text-zinc-600">(larger file size)</span>
            </div>
            <button
              onClick={handleExportAudit}
              disabled={exporting}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {exporting ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Exporting...
                </>
              ) : (
                <>
                  <span>📥</span>
                  Export Audit (JSON)
                </>
              )}
            </button>
          </div>

          {/* Export error toast */}
          {exportError && (
            <div className="mt-2 rounded border border-red-700/50 bg-red-950/20 px-2 py-1.5 flex items-start gap-2">
              <span className="text-xs text-red-300 flex-1">{exportError}</span>
              <button
                onClick={() => setExportError(null)}
                className="text-red-400 hover:text-red-300 transition-colors text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* Integrity details (expandable when BROKEN) */}
          {lastExport && !lastExport.integrity_check.is_valid && (
            <div className="mt-2 rounded border border-red-700/50 bg-red-950/20">
              <button
                onClick={() => setShowIntegrityDetails(!showIntegrityDetails)}
                className="flex w-full items-center justify-between px-2 py-1.5 text-left"
              >
                <span className="text-xs font-medium text-red-300">
                  Integrity Issues Detected
                </span>
                <span className="text-xs text-red-400">
                  {showIntegrityDetails ? '▲' : '▼'}
                </span>
              </button>
              {showIntegrityDetails && (
                <div className="border-t border-red-700/50 px-2 py-1.5 space-y-1">
                  <div className="text-[11px] text-red-300">
                    <span className="font-medium">Broken Links:</span> {lastExport.integrity_check.broken_links.length}
                  </div>
                  <div className="text-[11px] text-red-300">
                    <span className="font-medium">Orphaned Entries:</span> {lastExport.integrity_check.orphaned_entries.length}
                  </div>
                  <div className="text-[11px] text-red-300">
                    <span className="font-medium">Verified:</span> {lastExport.integrity_check.verified_entries}/{lastExport.integrity_check.total_entries}
                  </div>
                  {lastExport.duplicate_analysis.has_duplicates && (
                    <div className="text-[11px] text-yellow-400 mt-1">
                      <span className="font-medium">Duplicates:</span> {lastExport.duplicate_analysis.duplicates.length} duplicate computations found
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Success indicator */}
          {lastExport && lastExport.integrity_check.is_valid && (
            <div className="mt-2 space-y-2">
              <div className="rounded border border-green-700/50 bg-green-950/20 px-2 py-1.5">
                <p className="text-xs text-green-300">
                  ✓ Audit trail verified: {lastExport.integrity_check.verified_entries}/{lastExport.integrity_check.total_entries} entries validated
                  {lastExport.duplicate_analysis.has_duplicates && (
                    <span className="ml-2 text-yellow-400">
                      ({lastExport.duplicate_analysis.duplicates.length} duplicates detected)
                    </span>
                  )}
                </p>
              </div>

              {/* Phase 7.26: Signature info */}
              {lastExport.signature && (
                <div className="rounded border border-blue-700/50 bg-blue-950/20 px-2 py-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-blue-300">
                          🔐 Signed ({lastExport.signature.alg})
                        </span>
                        <span className="text-[10px] text-blue-400/70 font-mono">
                          key: {lastExport.signature.key_id}
                        </span>
                      </div>
                      <div className="text-[10px] text-blue-400/80 font-mono break-all">
                        {lastExport.signature.value.substring(0, 24)}...{lastExport.signature.value.substring(lastExport.signature.value.length - 8)}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (lastExport?.signature?.value) {
                          await navigator.clipboard.writeText(lastExport.signature.value);
                          // Could add toast notification here
                        }
                      }}
                      className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors px-1.5 py-0.5 rounded border border-blue-700/50 bg-blue-900/30"
                      title="Copy signature"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* History timeline */}
      {isExpanded && (
        <div className="border-t border-zinc-800 p-3">
          <div className="space-y-2">
            {history.map((entry, index) => {
              const previous = index < history.length - 1 ? history[index + 1] : null;
              const delta = getConfidenceDelta(entry, previous);
              const triggerInfo = getTriggerInfo(entry.trigger);

              return (
                <div
                  key={index}
                  className="group relative rounded border border-zinc-800/50 bg-zinc-950/30 p-2.5 transition-colors hover:border-zinc-700 hover:bg-zinc-900/50"
                >
                  {/* Timeline connector */}
                  {index < history.length - 1 && (
                    <div className="absolute -bottom-2 left-4 h-2 w-px bg-zinc-800" />
                  )}

                  {/* Header row: time + trigger */}
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-zinc-500">
                        {getRelativeTime(entry.computed_at)}
                      </span>
                      <span className="text-xs text-zinc-700">•</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${triggerInfo.color}`}>
                        {triggerInfo.icon} {triggerInfo.label}
                      </span>
                    </div>
                    {entry.actor_role !== 'system' && (
                      <span className="text-[10px] text-zinc-600">by {entry.actor_role}</span>
                    )}
                  </div>

                  {/* Confidence score with delta */}
                  <div className="mb-1 flex items-baseline gap-2">
                    <span className={`text-lg font-semibold ${getBandColor(entry.confidence_band)}`}>
                      {entry.confidence_score.toFixed(1)}%
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                      {entry.confidence_band}
                    </span>
                    {delta !== null && (
                      <span
                        className={`text-xs font-medium ${
                          delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-zinc-500'
                        }`}
                      >
                        {delta > 0 ? '↑' : delta < 0 ? '↓' : '='} {formatDelta(delta)}
                      </span>
                    )}
                  </div>

                  {/* Metrics row */}
                  <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
                    <span>
                      {entry.rules_passed}/{entry.rules_total} rules
                    </span>
                    {entry.gap_count > 0 && (
                      <>
                        <span className="text-zinc-700">•</span>
                        <span className="text-yellow-500/80">{entry.gap_count} gaps</span>
                      </>
                    )}
                    {entry.bias_count > 0 && (
                      <>
                        <span className="text-zinc-700">•</span>
                        <span className="text-red-500/80">{entry.bias_count} bias flags</span>
                      </>
                    )}
                  </div>

                  {/* Phase 7.25: Policy version display */}
                  {entry.policy_version && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-zinc-600">
                      <span className="text-zinc-700">Policy:</span>
                      <span className="font-mono">{entry.policy_version}</span>
                      {entry.policy_hash && (
                        <>
                          <span className="text-zinc-700">•</span>
                          <span 
                            className="font-mono text-zinc-700 cursor-help" 
                            title={`Policy hash: ${entry.policy_hash}`}
                          >
                            {entry.policy_hash.substring(0, 8)}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Phase 7.23: Compare to previous button */}
                  {previous && (
                    <div className="mt-2 pt-2 border-t border-zinc-800/50 flex gap-2">
                      <button
                        onClick={() => handleCompare(entry, previous)}
                        className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                      >
                        <span>⇄</span> Compare to previous
                      </button>
                      
                      {/* Phase 7.24: View evidence button */}
                      <button
                        onClick={() => handleViewEvidence(entry.id)}
                        className="text-[11px] text-green-400 hover:text-green-300 transition-colors flex items-center gap-1"
                      >
                        <span>📋</span> View evidence
                      </button>
                    </div>
                  )}

                  {/* Phase 7.23: Diff view (expanded) */}
                  {comparingEntry === entry.id && diffData && (
                    <div className="mt-2 pt-2 border-t border-zinc-800/50 space-y-2">
                      {/* Close button */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-300">Comparison</span>
                        <button
                          onClick={handleCloseDiff}
                          className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
                        >
                          ✕ Close
                        </button>
                      </div>

                      {(() => {
                        const diff = calculateDiff(diffData.current, diffData.previous);
                        
                        return (
                          <div className="rounded bg-zinc-950/50 border border-zinc-800/50 p-2 space-y-2">
                            {/* Decision change */}
                            {diff.decisionChanged && (
                              <div className="text-xs">
                                <span className="text-zinc-500">Decision:</span>{' '}
                                <span className="text-red-400 line-through">{diff.decision.old}</span>
                                {' → '}
                                <span className="text-green-400">{diff.decision.new}</span>
                              </div>
                            )}

                            {/* Confidence change */}
                            <div className="text-xs">
                              <span className="text-zinc-500">Confidence:</span>{' '}
                              <span className={diff.confidenceDelta >= 0 ? 'text-zinc-400' : 'text-zinc-500'}>
                                {diff.confidence.old.toFixed(1)}%
                              </span>
                              {' → '}
                              <span className={diff.confidenceDelta > 0 ? 'text-green-400' : diff.confidenceDelta < 0 ? 'text-red-400' : 'text-zinc-400'}>
                                {diff.confidence.new.toFixed(1)}%
                              </span>
                              <span className={`ml-1 text-[10px] ${diff.confidenceDelta > 0 ? 'text-green-400' : diff.confidenceDelta < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                                ({diff.confidenceDelta > 0 ? '+' : ''}{diff.confidenceDelta.toFixed(1)}%)
                              </span>
                            </div>

                            {/* Band change */}
                            {diff.band.old !== diff.band.new && (
                              <div className="text-xs">
                                <span className="text-zinc-500">Band:</span>{' '}
                                <span className="text-zinc-400">{diff.band.old}</span>
                                {' → '}
                                <span className={`font-medium ${getBandColor(diff.band.new)}`}>
                                  {diff.band.new}
                                </span>
                              </div>
                            )}

                            {/* Phase 7.25: Policy version change */}
                            {diff.policyVersionChanged && (
                              <div className="text-xs space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-zinc-500">Policy:</span>
                                  <span className="text-zinc-400 font-mono text-[10px]">{diff.policyVersion.old}</span>
                                  <span className="text-zinc-600">→</span>
                                  <span className="text-orange-400 font-mono text-[10px]">{diff.policyVersion.new}</span>
                                  <span className="ml-1 text-[10px] text-orange-400/80 bg-orange-400/10 px-1.5 py-0.5 rounded border border-orange-400/20">
                                    ⚠️ Policy changed
                                  </span>
                                </div>
                                {diff.policyVersion.newHash && diff.policyVersion.oldHash && (
                                  <div className="ml-2 text-[10px] text-zinc-600">
                                    <div className="font-mono">
                                      Old hash: {diff.policyVersion.oldHash.substring(0, 12)}...
                                    </div>
                                    <div className="font-mono">
                                      New hash: {diff.policyVersion.newHash.substring(0, 12)}...
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Rules changes */}
                            {(diff.rulesAdded.length > 0 || diff.rulesRemoved.length > 0) && (
                              <div className="text-xs space-y-1">
                                <div className="text-zinc-500">Rules:</div>
                                {diff.rulesAdded.length > 0 && (
                                  <div className="ml-2 space-y-0.5">
                                    {diff.rulesAdded.map((rule, idx) => (
                                      <div key={idx} className="text-green-400 text-[11px]">
                                        + {rule}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {diff.rulesRemoved.length > 0 && (
                                  <div className="ml-2 space-y-0.5">
                                    {diff.rulesRemoved.map((rule, idx) => (
                                      <div key={idx} className="text-red-400 text-[11px]">
                                        - {rule}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="text-[10px] text-zinc-600">
                                  Rules passed: {diff.rules.oldPassed} → {diff.rules.newPassed} of {diff.rules.total}
                                </div>
                              </div>
                            )}

                            {/* Gaps change */}
                            {diff.gapsDelta !== 0 && (
                              <div className="text-xs">
                                <span className="text-zinc-500">Gaps:</span>{' '}
                                <span className="text-zinc-400">{diff.gaps.old.length}</span>
                                {' → '}
                                <span className={diff.gapsDelta > 0 ? 'text-yellow-400' : 'text-green-400'}>
                                  {diff.gaps.new.length}
                                </span>
                                <span className={`ml-1 text-[10px] ${diff.gapsDelta > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                                  ({diff.gapsDelta > 0 ? '+' : ''}{diff.gapsDelta})
                                </span>
                              </div>
                            )}

                            {/* Bias change */}
                            {diff.biasDelta !== 0 && (
                              <div className="text-xs">
                                <span className="text-zinc-500">Bias Flags:</span>{' '}
                                <span className="text-zinc-400">{diff.bias.old.length}</span>
                                {' → '}
                                <span className={diff.biasDelta > 0 ? 'text-red-400' : 'text-green-400'}>
                                  {diff.bias.new.length}
                                </span>
                                <span className={`ml-1 text-[10px] ${diff.biasDelta > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                  ({diff.biasDelta > 0 ? '+' : ''}{diff.biasDelta})
                                </span>
                              </div>
                            )}

                            {/* Input hash (for debugging) */}
                            <div className="text-[10px] text-zinc-600 pt-1 border-t border-zinc-800/50">
                              Input hash: {diffData.current.input_hash.substring(0, 16)}...
                              {diffData.current.input_hash !== diffData.previous.input_hash && (
                                <span className="ml-1 text-yellow-400">(changed)</span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          {history.length >= limit && (
            <div className="mt-2 text-center">
              <p className="text-[10px] text-zinc-600">
                Showing last {limit} entries
              </p>
            </div>
          )}
        </div>
      )}

      {/* Phase 7.24: Evidence Viewer Modal */}
      {viewingEvidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[80vh] bg-zinc-900 rounded-lg border border-zinc-700 shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div>
                <h3 className="text-sm font-medium text-zinc-200">Evidence Snapshot</h3>
                <p className="text-xs text-zinc-500">Run: {viewingEvidence}</p>
              </div>
              <button
                onClick={handleCloseEvidence}
                className="text-zinc-400 hover:text-zinc-300 transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {evidenceLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                </div>
              )}

              {evidenceError && (
                <div className="rounded border border-red-700/50 bg-red-950/20 px-3 py-2">
                  <p className="text-xs text-red-300">{evidenceError}</p>
                </div>
              )}

              {evidenceData && (
                <>
                  {/* Evidence Hash */}
                  <div className="rounded border border-zinc-800 bg-zinc-950/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-zinc-400">Evidence Hash</span>
                      <button
                        onClick={handleCopyHash}
                        className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        📋 Copy
                      </button>
                    </div>
                    <code className="block text-[10px] text-zinc-300 font-mono break-all">
                      {evidenceData.evidence_hash}
                    </code>
                    <div className="mt-1 text-[10px] text-zinc-600">
                      Version: {evidenceData.evidence_version || 'unknown'}
                    </div>
                  </div>

                  {/* Case State */}
                  <div className="rounded border border-zinc-800 bg-zinc-950/50 p-3">
                    <div className="text-xs font-medium text-zinc-400 mb-2">Case State</div>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Status:</span>
                        <span className="text-zinc-300">{evidenceData.evidence_snapshot.case.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Type:</span>
                        <span className="text-zinc-300">{evidenceData.evidence_snapshot.case.decision_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Snapshot at:</span>
                        <span className="text-zinc-300">
                          {new Date(evidenceData.evidence_snapshot.snapshot_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Submission Fields */}
                  {evidenceData.evidence_snapshot.submission && (
                    <div className="rounded border border-zinc-800 bg-zinc-950/50 p-3">
                      <div className="text-xs font-medium text-zinc-400 mb-2">
                        Submission Fields ({evidenceData.evidence_snapshot.submission.field_count})
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {Object.entries(evidenceData.evidence_snapshot.submission.fields).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-[11px]">
                            <span className="text-zinc-500">{key}:</span>
                            <span className={value.present ? 'text-green-400' : 'text-red-400'}>
                              {value.present ? `✓ ${value.type} (${value.length} chars)` : '✗ missing'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  {evidenceData.evidence_snapshot.attachments.length > 0 && (
                    <div className="rounded border border-zinc-800 bg-zinc-950/50 p-3">
                      <div className="text-xs font-medium text-zinc-400 mb-2">
                        Attachments ({evidenceData.evidence_snapshot.attachments.length})
                      </div>
                      <div className="space-y-1.5">
                        {evidenceData.evidence_snapshot.attachments.map((att) => (
                          <div key={att.id} className="text-[11px] text-zinc-300">
                            <div className="font-medium">{att.filename}</div>
                            <div className="text-zinc-500">
                              {att.mime_type} • {(att.size_bytes / 1024).toFixed(1)} KB
                              {att.category && ` • ${att.category}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Request Info Responses */}
                  {evidenceData.evidence_snapshot.request_info_responses > 0 && (
                    <div className="rounded border border-zinc-800 bg-zinc-950/50 p-3">
                      <div className="text-xs font-medium text-zinc-400">Request Info Responses</div>
                      <div className="text-[11px] text-zinc-300 mt-1">
                        {evidenceData.evidence_snapshot.request_info_responses} response(s) on file
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {evidenceData && (
              <div className="border-t border-zinc-800 px-4 py-3 flex justify-end gap-2">
                <button
                  onClick={handleDownloadEvidence}
                  className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                >
                  📥 Download JSON
                </button>
                <button
                  onClick={handleCloseEvidence}
                  className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
