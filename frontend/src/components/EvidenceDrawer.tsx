/**
 * Evidence Drawer Component
 * 
 * Modal drawer for viewing full evidence details and controlling
 * packet inclusion.
 * 
 * Step 2.5: Evidence Drilldown Drawer + Packet Inclusion Controls
 */

import React, { useEffect, useState } from 'react';
import { EvidenceItem } from '../types/evidence';
import { packetEvidenceStore } from '../lib/packetEvidenceStore';

interface EvidenceDrawerProps {
  open: boolean;
  onClose: () => void;
  evidence: EvidenceItem | null;
  caseId: string;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  open,
  onClose,
  evidence,
  caseId,
}) => {
  const [included, setIncluded] = useState(true);
  const [snippetExpanded, setSnippetExpanded] = useState(false);

  useEffect(() => {
    if (evidence) {
      setIncluded(packetEvidenceStore.isEvidenceIncluded(caseId, evidence.id));
    }
  }, [evidence, caseId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  const handleToggleIncluded = () => {
    if (!evidence) return;
    const newIncluded = packetEvidenceStore.toggleEvidenceIncluded(caseId, evidence.id);
    setIncluded(newIncluded);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!open || !evidence) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end bg-black bg-opacity-30"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-2xl bg-white shadow-2xl overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b bg-gray-50 px-6 py-4 flex items-center justify-between sticky top-0">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">Evidence Details</h2>
            <p className="text-sm text-gray-600 mt-1">{evidence.label}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2"
            aria-label="Close drawer"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-6 space-y-6">
          {/* Inclusion Control */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                checked={included}
                onChange={handleToggleIncluded}
                className="mt-1 h-5 w-5 text-blue-600 rounded"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {included ? 'Included in Export Packet' : 'Excluded from Export Packet'}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {included
                    ? 'This evidence will be included in the decision packet export.'
                    : 'This evidence will NOT be included in the export packet.'}
                </p>
              </div>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {evidence.jurisdiction && (
              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                {evidence.jurisdiction}
              </span>
            )}
            {evidence.decisionType && (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                {evidence.decisionType}
              </span>
            )}
            {evidence.tags?.map((tag, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Citation */}
          {evidence.citation && (
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Citation
              </p>
              <p className="text-sm text-gray-900 font-mono">{evidence.citation}</p>
              <button
                onClick={() => handleCopy(evidence.citation!)}
                className="text-xs text-blue-600 hover:text-blue-800 mt-2"
              >
                Copy Citation
              </button>
            </div>
          )}

          {/* Snippet */}
          {evidence.snippet && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Excerpt
                </p>
                <button
                  onClick={() => setSnippetExpanded(!snippetExpanded)}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  {snippetExpanded ? 'Collapse' : 'Expand'}
                </button>
              </div>
              <div
                className={`bg-gray-50 rounded-lg p-4 text-sm text-gray-800 leading-relaxed ${
                  snippetExpanded ? '' : 'line-clamp-6'
                }`}
              >
                {evidence.snippet}
              </div>
              <button
                onClick={() => handleCopy(evidence.snippet!)}
                className="text-xs text-blue-600 hover:text-blue-800 mt-2"
              >
                Copy Excerpt
              </button>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            {evidence.effectiveDate && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Effective Date
                </p>
                <p className="text-sm text-gray-900">{evidence.effectiveDate}</p>
              </div>
            )}
            {evidence.sourceUrl && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Source
                </p>
                <a
                  href={evidence.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  View Original
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-end space-x-3 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
