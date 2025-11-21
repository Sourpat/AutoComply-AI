import React from "react";

/**
 * ComplianceCard
 *
 * Renders the main decision coming back from the AutoComply AI backend:
 * - allow/deny checkout
 * - expiry status / days to expiry
 * - regulatory context snippets
 * - (new) attestation requirements
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
 *   extracted_fields?: { ... } // optional OCR summary
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
  const statePermit = verdict.state_permit || data.state_permit || data.permit;
  const licenseId = verdict.license_id || data.license_id;
  const regulatoryContext = verdict.regulatory_context || [];
  const attestations = verdict.attestations_required || [];
  const extractedFields = data.extracted_fields || null;

  const hasAttestations = Array.isArray(attestations) && attestations.length > 0;

  const headline = allowCheckout
    ? hasAttestations
      ? "Allowed – attestation required"
      : "Allowed for checkout"
    : "Checkout blocked";

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

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            Compliance result
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Deterministic decision from the AutoComply AI engine for this
            license and scenario.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${statusPillClasses}`}
          >
            <span className={`h-2 w-2 rounded-full ${statusDotClasses}`} />
            <span>{headline}</span>
          </div>
          {typeof daysToExpiry === "number" && !Number.isNaN(daysToExpiry) && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {daysToExpiry < 0
                ? `Expired ${Math.abs(daysToExpiry)} day${
                    Math.abs(daysToExpiry) === 1 ? "" : "s"
                  } ago`
                : daysToExpiry === 0
                ? "Expires today"
                : `Expires in ${daysToExpiry} day${
                    daysToExpiry === 1 ? "" : "s"
                  }`}
            </span>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
        {headlineDescription}
      </p>

      {/* Main details */}
      <div className="mt-4 grid gap-3 rounded-xl bg-slate-50/80 p-3 text-xs dark:bg-slate-800/70">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <DetailItem label="Status" value={status} />
          <DetailItem
            label="Allow checkout"
            value={allowCheckout ? "Yes" : "No"}
          />
          <DetailItem label="State" value={state || "—"} />
          <DetailItem label="State permit" value={statePermit || "—"} />
          <DetailItem label="License ID" value={licenseId || "—"} />
          {typeof daysToExpiry === "number" && (
            <DetailItem
              label="Days to expiry"
              value={String(daysToExpiry)}
              emphasize={daysToExpiry <= 30}
            />
          )}
        </div>
      </div>

      {/* Attestations section */}
      {hasAttestations && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs text-amber-800 dark:bg-amber-800/60 dark:text-amber-50">
                !
              </span>
              <div>
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                  Attestations required
                </p>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80">
                  These statements must be acknowledged before proceeding with
                  controlled-substance checkout.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-800/70 dark:text-amber-50">
              {attestations.length} required
            </span>
          </div>

          <div className="space-y-3">
            {attestations.map((att, idx) => (
              <div
                key={`${att.id}-${idx}`}
                className="rounded-lg bg-white/80 p-3 text-[11px] shadow-sm ring-1 ring-amber-100 dark:bg-amber-950/40 dark:ring-amber-800/70"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/70 dark:text-amber-100">
                    {att.jurisdiction || "Jurisdiction"}
                  </span>
                  {att.id && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                      {att.id}
                    </span>
                  )}
                  {att.must_acknowledge && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-800/80 dark:text-amber-50">
                      Must acknowledge
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-50">
                  {att.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regulatory context */}
      {regulatoryContext.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            Regulatory context
          </h3>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Condensed snippets from underlying rules to explain the decision.
            This is for human understanding, not a substitute for legal advice.
          </p>
          <div className="mt-2 space-y-2 text-[11px]">
            {regulatoryContext.map((ctx, idx) => (
              <div
                key={idx}
                className="rounded-lg bg-slate-50/80 p-2.5 dark:bg-slate-800/70"
              >
                {ctx.source && (
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {ctx.source}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                  {ctx.snippet || ctx.text || ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extracted fields (optional, for OCR flows) */}
      {extractedFields && (
        <div className="mt-5">
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
            Extracted from document
          </h3>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Key fields AutoComply AI inferred from the uploaded PDF. These are
            fed into the same decision engine as manual entries.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
            {Object.entries(extractedFields).map(([key, value]) => (
              <div
                key={key}
                className="rounded-lg bg-slate-50/80 p-2 dark:bg-slate-800/70"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {key}
                </p>
                <p className="mt-0.5 text-slate-700 dark:text-slate-200">
                  {String(value ?? "—")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const DetailItem = ({ label, value, emphasize = false }) => {
  const valueClasses = emphasize
    ? "text-xs font-semibold text-amber-800 dark:text-amber-200"
    : "text-xs text-slate-800 dark:text-slate-100";

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span className={valueClasses}>{value ?? "—"}</span>
    </div>
  );
};

export default ComplianceCard;
