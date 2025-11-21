import React, { useState, useEffect } from "react";

/**
 * ComplianceCard
 *
 * Renders the main decision coming back from the AutoComply AI backend:
 * - allow/deny checkout
 * - expiry status / days to expiry
 * - regulatory context snippets
 * - attestation requirements
 * - local "proceed to checkout" soft gate based on attestation acknowledgement
 * - extracted fields from uploaded PDF (state / permit / expiry / text preview)
 *
 * Expects a `data` prop shaped like:
 * {
 *   success: boolean,
 *   verdict: {
 *     allow_checkout: boolean,
 *     status: string,
 *     is_expired?: boolean,
 *     days_to_expiry?: number,
 *     state?: string,
 *     state_permit?: string,
 *     license_id?: string,
 *     regulatory_context?: Array<{ source?: string; snippet?: string }>,
 *     attestations_required?: Array<{
 *       id: string;
 *       jurisdiction: string;
 *       scenario: string;
 *       text: string;
 *       must_acknowledge: boolean;
 *     }>
 *   },
 *   extracted_fields?: {
 *     file_name?: string;
 *     text_preview?: string;
 *     character_count?: number;
 *     parsed_state?: string;
 *     parsed_state_permit?: string;
 *     parsed_state_expiry?: string;
 *   }
 * }
 */
const ComplianceCard = ({ data }) => {
  if (!data || !data.verdict) {
    return null;
  }

  const verdict = data.verdict;

  const allowCheckout = verdict.allow_checkout;
  const status = verdict.status || "Unknown";
  const isExpired = verdict.is_expired;
  const daysToExpiry = verdict.days_to_expiry;

  const state = verdict.state || data.state;
  const statePermit =
    verdict.state_permit || data.state_permit || data.permit || null;
  const licenseId = verdict.license_id || data.license_id || null;

  const regulatoryContext = verdict.regulatory_context || [];
  const attestations = verdict.attestations_required || [];
  const extractedFields = data.extracted_fields || null;

  const hasAttestations =
    Array.isArray(attestations) && attestations.length > 0;
  const attestationCount = hasAttestations ? attestations.length : 0;

  // Local "soft gating" state: simulated user acknowledgement of attestations
  const [attestationsConfirmed, setAttestationsConfirmed] = useState(false);

  // Reset acknowledgement when the decision changes (new license, new verdict, etc.)
  useEffect(() => {
    setAttestationsConfirmed(false);
  }, [licenseId, allowCheckout, attestationCount]);

  const needsAck = allowCheckout && hasAttestations;
  const canProceed = allowCheckout && (!hasAttestations || attestationsConfirmed);

  const headline = allowCheckout
    ? hasAttestations
      ? "Allowed – attestation required"
      : "Allowed for checkout"
    : "Checkout blocked";

  // Status pill text (short but expressive)
  const statusLabel = !allowCheckout
    ? "Blocked"
    : hasAttestations
    ? attestationCount === 1
      ? "Allowed · 1 attestation pending"
      : `Allowed · ${attestationCount} attestations pending`
    : "Allowed · No attestations";

  const headlineDescription = (() => {
    if (!allowCheckout) {
      return "This license or scenario does not currently satisfy the rules required for controlled-substance checkout.";
    }
    if (hasAttestations) {
      return "The license appears valid, but at least one attestation must be completed before proceeding.";
    }
    return "The license is currently valid for the requested scenario.";
  })();

  const statusPillClasses = allowCheckout
    ? hasAttestations
      ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-700"
      : "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-700"
    : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-100 dark:border-rose-700";

  const statusDotClasses = allowCheckout
    ? hasAttestations
      ? "bg-amber-500"
      : "bg-emerald-500"
    : "bg-rose-500";

  const proceedButtonClasses = canProceed
    ? "inline-flex items-center justify-center rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm bg-slate-900 text-slate-50 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-colors"
    : "inline-flex items-center justify-center rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400 cursor-not-allowed";

  const proceedLabel = (() => {
    if (!allowCheckout) {
      return "Checkout blocked by engine";
    }
    if (hasAttestations && !attestationsConfirmed) {
      return "Acknowledge attestations to proceed";
    }
    return "Proceed to checkout (simulated)";
  })();

  // Simple tooltip text for "why is attestation required?"
  const attestationReasonHint =
    hasAttestations && attestations[0]
      ? `Required because this scenario matches: ${
          attestations[0].scenario || "a regulated telemedicine/licensing rule"
        }${
          attestations[0].jurisdiction
            ? ` (${attestations[0].jurisdiction})`
            : ""
        }`
      : "Required based on the evaluated license, state, and scenario.";

  // Extracted / parsed fields from PDF (if present)
  const parsedState = extractedFields?.parsed_state || null;
  const parsedPermit = extractedFields?.parsed_state_permit || null;
  const parsedExpiry = extractedFields?.parsed_state_expiry || null;
  const textPreview = extractedFields?.text_preview || "";
  const fileName = extractedFields?.file_name || "";
  const charCount = extractedFields?.character_count;
  const hasParsed = parsedState || parsedPermit || parsedExpiry;

  return (
    <section className="mt-6 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80">
      {/* Header: status + primary verdict */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium tracking-tight shadow-sm dark:border-slate-600">
            <span className={`inline-flex h-2 w-2 rounded-full ${statusDotClasses}`} />
            <span className={statusPillClasses + " border-none bg-transparent px-0 py-0"}>
              {statusLabel}
            </span>
          </div>

          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {headline}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {headlineDescription}
            </p>
          </div>

          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
            {state && (
              <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 dark:bg-slate-800/60">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
                State: <span className="ml-1 font-medium">{state}</span>
              </span>
            )}
            {statePermit && (
              <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 dark:bg-slate-800/60">
                Permit: <span className="ml-1 font-mono text-[11px]">{statePermit}</span>
              </span>
            )}
            {licenseId && (
              <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 dark:bg-slate-800/60">
                License ID:{" "}
                <span className="ml-1 font-mono text-[11px]">{licenseId}</span>
              </span>
            )}
            {typeof daysToExpiry === "number" && (
              <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 dark:bg-slate-800/60">
                {isExpired
                  ? "Expired"
                  : daysToExpiry === 0
                  ? "Expires today"
                  : `~${daysToExpiry} days to expiry`}
              </span>
            )}
          </div>
        </div>

        {/* Proceed soft gate */}
        <div className="flex flex-col items-end gap-2 text-right">
          <button
            type="button"
            className={proceedButtonClasses}
            disabled={!canProceed}
          >
            {proceedLabel}
          </button>
          {needsAck && (
            <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-900"
                checked={attestationsConfirmed}
                onChange={(e) => setAttestationsConfirmed(e.target.checked)}
              />
              <span>
                I confirm that all required attestations below have been reviewed
                and are accurate.
              </span>
            </label>
          )}
        </div>
      </div>

      {/* Attestations block */}
      {hasAttestations && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-50">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-[11px] font-semibold text-amber-900 dark:bg-amber-800 dark:text-amber-50">
                !
              </span>
              <div>
                <p className="text-xs font-semibold tracking-tight">
                  Attestations required before completing checkout
                </p>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-100/80">
                  {attestationReasonHint}
                </p>
              </div>
            </div>
          </div>

          <ul className="mt-3 space-y-2">
            {attestations.map((att, idx) => (
              <li
                key={att.id || idx}
                className="rounded-lg bg-white/70 p-3 text-[11px] shadow-sm ring-1 ring-amber-100 dark:bg-amber-900/30 dark:ring-amber-800/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold">
                    {att.jurisdiction || "Attestation"}
                    {att.scenario ? ` · ${att.scenario}` : ""}
                  </div>
                  {att.must_acknowledge && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-800 dark:text-amber-50">
                      Required
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-amber-900 dark:text-amber-50">
                  {att.text}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Regulatory context */}
      {Array.isArray(regulatoryContext) && regulatoryContext.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-tight">
              Why this decision was made
            </p>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Source context (demo)
            </span>
          </div>
          <ul className="space-y-2">
            {regulatoryContext.map((ctx, idx) => (
              <li key={idx} className="rounded-md bg-white/80 p-3 dark:bg-slate-900/60">
                {ctx.source && (
                  <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                    {ctx.source}
                  </p>
                )}
                {ctx.snippet && (
                  <p className="mt-1 text-[11px] leading-snug text-slate-700 dark:text-slate-100">
                    {ctx.snippet}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Extracted-from-document block (for PDF uploads) */}
      {extractedFields && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold tracking-tight">
                Extracted from document
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Parsed fields and OCR preview from the uploaded license PDF.
              </p>
            </div>
            <div className="text-right text-[11px] text-slate-500 dark:text-slate-400">
              {fileName && <p className="truncate max-w-[180px]">{fileName}</p>}
              {typeof charCount === "number" && (
                <p>{charCount} characters scanned</p>
              )}
            </div>
          </div>

          {hasParsed && (
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              {parsedState && (
                <div className="rounded-lg bg-white/80 p-3 text-[11px] shadow-sm dark:bg-slate-900/60">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Parsed state
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-50">
                    {parsedState}
                  </dd>
                </div>
              )}
              {parsedPermit && (
                <div className="rounded-lg bg-white/80 p-3 text-[11px] shadow-sm dark:bg-slate-900/60">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Parsed permit / license
                  </dt>
                  <dd className="mt-1 font-mono text-[11px] text-slate-900 dark:text-slate-50">
                    {parsedPermit}
                  </dd>
                </div>
              )}
              {parsedExpiry && (
                <div className="rounded-lg bg-white/80 p-3 text-[11px] shadow-sm dark:bg-slate-900/60">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Parsed expiry
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-50">
                    {parsedExpiry}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {textPreview && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                OCR text preview
              </p>
              <p className="mt-1 max-h-40 overflow-auto rounded-lg bg-white/80 p-3 text-[11px] leading-snug text-slate-800 shadow-inner dark:bg-slate-900/70 dark:text-slate-100">
                {textPreview}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default ComplianceCard;
