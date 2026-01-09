import React, { useState, useEffect } from "react";
import type { RagSource } from "../types/rag";
import type { EvidenceItem } from "../types/evidence";
import { packetEvidenceStore } from "../lib/packetEvidenceStore";

interface RagSourceCardProps {
  source: RagSource;
  index?: number; // optional rank index starting from 0
  onExplain?: (source: RagSource) => void; // callback for Explain button
  onOpenInPreview?: (source: RagSource) => void; // callback for Open in Preview
  onOpenEvidence?: (evidence: EvidenceItem) => void; // callback for Evidence Drilldown
  caseId?: string; // For packet inclusion tracking
  showInclusionControls?: boolean; // Whether to show checkbox for packet inclusion
}

const getRelevanceBadge = (score: number) => {
  if (score >= 0.75) {
    return {
      label: 'High',
      className: 'bg-green-500/20 text-green-400 border-green-500/40'
    };
  } else if (score >= 0.45) {
    return {
      label: 'Med',
      className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
    };
  } else {
    return {
      label: 'Low',
      className: 'bg-slate-500/20 text-slate-400 border-slate-500/40'
    };
  }
};

export const RagSourceCard: React.FC<RagSourceCardProps> = ({ 
  source, 
  index, 
  onExplain, 
  onOpenInPreview, 
  onOpenEvidence,
  caseId,
  showInclusionControls = false,
}) => {
  const rank = typeof index === "number" ? index + 1 : undefined;
  const score = source.score ?? 0;
  const [expanded, setExpanded] = useState(false);
  const relevance = getRelevanceBadge(score);
  const evidenceId = source.id ?? `evidence-${Date.now()}`;
  
  // Track inclusion state if controls are enabled
  const [included, setIncluded] = useState(true);

  useEffect(() => {
    if (showInclusionControls && caseId) {
      setIncluded(packetEvidenceStore.isEvidenceIncluded(caseId, evidenceId));
    }
  }, [showInclusionControls, caseId, evidenceId]);

  const handleToggleIncluded = () => {
    if (!showInclusionControls || !caseId) return;
    const newIncluded = packetEvidenceStore.toggleEvidenceIncluded(caseId, evidenceId);
    setIncluded(newIncluded);
  };

  const handleCopyCitation = () => {
    const docTitle = source.label || source.citation || 'Regulatory reference';
    const jurisdiction = source.jurisdiction || 'N/A';
    const section = source.citation || 'snippet';
    const citation = `${docTitle} (${jurisdiction}) — ${section}`;
    navigator.clipboard.writeText(citation);
  };

  const handleOpenEvidence = () => {
    if (!onOpenEvidence) return;
    
    // Convert RagSource to EvidenceItem
    const evidence: EvidenceItem = {
      id: source.id ?? `evidence-${Date.now()}`,
      label: source.label ?? 'Regulatory Reference',
      jurisdiction: source.jurisdiction,
      citation: source.citation,
      snippet: source.snippet,
      sourceUrl: source.url,
      decisionType: source.source_type,
      tags: source.source_type ? [source.source_type] : undefined,
    };
    
    onOpenEvidence(evidence);
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 flex flex-col gap-2 transition-all duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          {/* Inclusion Checkbox */}
          {showInclusionControls && caseId && (
            <input
              type="checkbox"
              checked={included}
              onChange={handleToggleIncluded}
              className="mt-1 h-4 w-4 text-blue-600 rounded shrink-0"
              title={included ? "Included in export packet" : "Excluded from export packet"}
            />
          )}

          <div className="flex flex-col gap-0.5 flex-1">
            <div className="flex items-center gap-2">
              {rank !== undefined && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-slate-500/60 text-slate-200/90">
                  #{rank}
                </span>
              )}
              <span className="text-xs font-semibold text-slate-50">
                {source.label || source.citation || "Regulatory reference"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1 mt-0.5">
              {source.jurisdiction && (
                <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border border-slate-600/80 text-slate-200/90">
                  {source.jurisdiction}
                </span>
              )}
              {source.citation && (
                <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border border-slate-600/60 text-slate-200/80">
                  {source.citation}
                </span>
              )}
              {source.source_type && (
                <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border border-slate-600/40 text-slate-300/80">
                  {source.source_type}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Relevance badge and View snippet button */}
        <div className="flex items-start gap-2">
          <div className="flex flex-col items-end gap-1">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold ${relevance.className}`}
              title={`Score: ${score.toFixed(2)}`}
            >
              {relevance.label}
            </span>
            <span className="text-[9px] text-slate-500 tabular-nums">Score: {score.toFixed(2)}</span>
          </div>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-2 py-1 text-[10px] font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors shrink-0"
            title={expanded ? "Collapse snippet" : "Expand snippet"}
          >
            {expanded ? "Hide" : "View snippet"}
          </button>
        </div>
      </div>

      {/* Snippet preview (collapsed) */}
      {!expanded && source.snippet && (
        <p className="text-xs text-slate-200/90 leading-snug line-clamp-2">
          {source.snippet}
        </p>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="space-y-3 pt-2 border-t border-slate-700/50 animate-in slide-in-from-top-2 duration-200">
          {/* Snippet */}
          {source.snippet && (
            <div>
              <div className="text-[10px] font-semibold text-slate-400 mb-1.5">Full Snippet</div>
              <p className="text-xs text-slate-100 leading-relaxed whitespace-pre-wrap bg-slate-800/50 rounded px-3 py-2">
                {source.snippet}
              </p>
            </div>
          )}
          
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-2">
            {source.label && (
              <div>
                <span className="text-[10px] font-semibold text-slate-400">Document:</span>
                <span className="text-[10px] text-slate-200 ml-1">{source.label}</span>
              </div>
            )}
            {source.jurisdiction && (
              <div>
                <span className="text-[10px] font-semibold text-slate-400">Jurisdiction:</span>
                <span className="text-[10px] text-slate-200 ml-1">{source.jurisdiction}</span>
              </div>
            )}
            {source.source_type && (
              <div>
                <span className="text-[10px] font-semibold text-slate-400">Type:</span>
                <span className="text-[10px] text-slate-200 ml-1">{source.source_type}</span>
              </div>
            )}
            {source.citation && (
              <div>
                <span className="text-[10px] font-semibold text-slate-400">Section:</span>
                <span className="text-[10px] text-slate-200 ml-1 font-mono">{source.citation}</span>
              </div>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-2">
            {onOpenEvidence && (
              <button
                onClick={handleOpenEvidence}
                className="flex-1 px-3 py-1.5 text-[11px] font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
              >
                📋 View Evidence Details
              </button>
            )}
            {onOpenInPreview && (
              <button
                onClick={() => onOpenInPreview(source)}
                className="flex-1 px-3 py-1.5 text-[11px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                Open in Preview
              </button>
            )}
            <button
              onClick={handleCopyCitation}
              className="flex-1 px-3 py-1.5 text-[11px] font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors"
            >
              Copy citation
            </button>
          </div>
        </div>
      )}

      {/* Optional URL footer */}
      {source.url && (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-slate-400 hover:text-slate-200 underline-offset-2 hover:underline"
        >
          Open source
        </a>
      )}
    </div>
  );
};
