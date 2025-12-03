// src/components/PractitionerCsfSandbox.tsx
import React, { useEffect, useState } from "react";
import {
  PractitionerCsfDecision,
  PractitionerCsfFormData,
  PractitionerFacilityType,
  PractitionerFormCopilotResponse,
} from "../domain/csfPractitioner";
import { explainCsfDecision } from "../api/csfExplainClient";
import type { CsfDecisionSummary } from "../api/csfExplainClient";
import {
  fetchComplianceArtifacts,
  type ComplianceArtifact,
} from "../api/complianceArtifactsClient";
import { callRegulatoryRag } from "../api/ragRegulatoryClient";
import { callPractitionerFormCopilot } from "../api/csfPractitionerCopilotClient";
import { ControlledSubstancesPanel } from "./ControlledSubstancesPanel";
import type { ControlledSubstance } from "../api/controlledSubstancesClient";
import { SourceDocumentChip } from "./SourceDocumentChip";
import { FormCopilotDetailsCard } from "../components/FormCopilotDetailsCard";
import { CopyCurlButton } from "./CopyCurlButton";
import { emitCodexCommand } from "../utils/codexLogger";
import {
  OhioTdddDecision,
  OhioTdddFormData,
} from "../domain/licenseOhioTddd";
import { evaluateOhioTdddLicense } from "../api/licenseOhioTdddClient";
import { mapPractitionerFormToOhioTddd } from "../domain/licenseMapping";
import { trackSandboxEvent } from "../devsupport/telemetry";
import { TestCoverageNote } from "./TestCoverageNote";
import { buildCurlCommand } from "../utils/curl";

// Vite-friendly helper: no `process` in the browser
const getApiBase = (): string => {
  // 1) Prefer Vite env variables if present
  const metaEnv = (import.meta as any)?.env ?? {};
  const viteBase =
    (metaEnv.VITE_API_BASE as string | undefined) ??
    (metaEnv.VITE_API_BASE_URL as string | undefined);

  if (viteBase !== undefined) {
    return viteBase;
  }

  // 2) Local dev: frontend on 5173, backend on 8000
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  ) {
    return "http://127.0.0.1:8000";
  }

  // 3) Fallback: same origin (for deployed envs)
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.host}`;
  }

  // 4) Last resort – empty string; UI will show a config error
  return "";
};

const API_BASE = getApiBase();

const ErrorAlert = ({
  message,
  tone = "error",
}: {
  message: string;
  tone?: "error" | "warning";
}) => {
  const toneStyles =
    tone === "warning"
      ? "bg-amber-50 text-amber-800 ring-1 ring-amber-100"
      : "bg-red-50 text-red-700 ring-1 ring-red-100";

  return (
    <div className={`rounded-md px-2 py-1 text-[11px] ${toneStyles}`}>
      {message}
    </div>
  );
};

const CSF_PRACTITIONER_SOURCE_DOCUMENT =
  "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf";

type PractitionerCsfPayload = {
  facility_name: string;
  facility_type: string;
  account_number: string;
  practitioner_name: string;
  state_license_number: string;
  dea_number: string;
  ship_to_state: string;
  attestation_accepted: boolean;
  internal_notes: string | null;
};

const buildPractitionerCsfPayload = (
  form: PractitionerCsfFormData
): PractitionerCsfPayload => {
  const trim = (v: string | undefined | null) => (v ?? "").trim();

  return {
    facility_name: trim(form.facilityName),
    facility_type: form.facilityType, // use the enum key the backend expects
    account_number: trim(form.accountNumber),
    practitioner_name: trim(form.practitionerName),
    state_license_number: trim(form.stateLicenseNumber),
    dea_number: trim(form.deaNumber),
    ship_to_state: form.shipToState, // e.g. "NY"
    attestation_accepted: form.attestationAccepted,
    internal_notes: trim(form.internalNotes) || null,
  };
};

const deriveSourceDocuments = (
  regulatoryReferences: any[] | undefined
): string[] => {
  const docs = (regulatoryReferences ?? [])
    .map((ref) =>
      typeof ref === "string" ? undefined : (ref as any)?.source_document
    )
    .filter(Boolean) as string[];

  return docs.length ? docs : [CSF_PRACTITIONER_SOURCE_DOCUMENT];
};

const callPractitionerEvaluate = async (
  apiBase: string,
  form: PractitionerCsfFormData
) => {
  const payload = buildPractitionerCsfPayload(form);

  const resp = await fetch(`${apiBase}/csf/practitioner/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    throw new Error(`Evaluate failed: ${resp.status}`);
  }

  return resp.json();
};

type ItemHistory = {
  item_id: string;
  name: string;
  strength: string;
  dosage_form: string;
  dea_schedule: string;
  last_purchase_date: string;
  last_ship_to_state: string;
  last_decision_status: string;
  total_orders_12m: number;
  verification_flags: string[];
  source_documents: string[];
};

type PractitionerCsfExampleId =
  | "primary_care"
  | "pain_clinic"
  | "telehealth_only";

type PractitionerCsfExample = {
  id: PractitionerCsfExampleId;
  label: string;
  description: string;
  formData: PractitionerCsfFormData;
};

const PRACTITIONER_EXAMPLES: PractitionerCsfExample[] = [
  {
    id: "primary_care",
    label: "Primary care prescriber (happy path)",
    description:
      "Board-certified internal medicine physician in NY with clean DEA and state license. Good for an ok_to_ship decision.",
    formData: {
      facilityName: "Hudson Valley Primary Care",
      facilityType: "group_practice",
      accountNumber: "ACCT-22001",
      practitionerName: "Dr. Alicia Patel",
      stateLicenseNumber: "NY-1023498",
      deaNumber: "AP1234567",
      shipToState: "NY",
      attestationAccepted: true,
      internalNotes:
        "Established primary care practice with stable CS prescribing patterns.",
      controlledSubstances: [
        {
          id: "cs_clonazepam_0_5mg",
          name: "Clonazepam 0.5mg",
          ndc: "00093-0063-01",
          dea_schedule: "IV",
          schedule: "IV",
        },
      ],
    },
  },
  {
    id: "pain_clinic",
    label: "Pain clinic (needs review)",
    description:
      "Pain management clinic with heavy Schedule II prescribing and prior audit notes. Good for a needs_review outcome.",
    formData: {
      facilityName: "Central Ohio Pain Clinic",
      facilityType: "clinic",
      accountNumber: "ACCT-44110",
      practitionerName: "Dr. Jordan Reyes",
      stateLicenseNumber: "OH-4432109",
      deaNumber: "BR2345678",
      shipToState: "OH",
      attestationAccepted: true,
      internalNotes:
        "Clinic flagged for periodic review due to high volume of Schedule II prescriptions.",
      controlledSubstances: [
        {
          id: "cs_oxycodone_10mg",
          name: "Oxycodone 10mg",
          ndc: "00406-0512-02",
          dea_schedule: "II",
          schedule: "II",
        },
      ],
    },
  },
  {
    id: "telehealth_only",
    label: "Telehealth-only prescriber (blocked)",
    description:
      "Telehealth-only prescriber trying to ship certain CS into a restricted state with incomplete license details. Good for a blocked outcome.",
    formData: {
      facilityName: "Bridgeway Telehealth",
      facilityType: "individual_practitioner",
      accountNumber: "ACCT-88990",
      practitionerName: "Dr. Emily Novak",
      stateLicenseNumber: "",
      deaNumber: "BN3456789",
      shipToState: "OH",
      attestationAccepted: false,
      internalNotes:
        "Telehealth-only practice; state-level restrictions may apply for Schedule II shipments.",
      controlledSubstances: [
        {
          id: "cs_adderall_xr_20mg",
          name: "Adderall XR 20mg",
          ndc: "54092-0381-01",
          dea_schedule: "II",
          schedule: "II",
        },
      ],
    },
  },
];

const initialForm: PractitionerCsfFormData = {
  facilityName: "",
  facilityType: "dental_practice",
  accountNumber: "",
  practitionerName: "",
  stateLicenseNumber: "",
  deaNumber: "",
  shipToState: "OH",
  attestationAccepted: false,
  internalNotes: "",
};

export function PractitionerCsfSandbox() {
  const [form, setForm] = useState<PractitionerCsfFormData>(initialForm);
  const [selectedExampleId, setSelectedExampleId] =
    React.useState<PractitionerCsfExampleId>("primary_care");
  const [decision, setDecision] = useState<PractitionerCsfDecision | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiBaseError, setApiBaseError] = useState<string | null>(
    API_BASE
      ? null
      : "Sandbox misconfigured: missing API base URL. Please set VITE_API_BASE in your environment before using Practitioner CSF tools."
  );
  const [controlledSubstances, setControlledSubstances] = useState<
    ControlledSubstance[]
  >([]);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [regulatoryArtifacts, setRegulatoryArtifacts] = useState<
    ComplianceArtifact[]
  >([]);
  const [isLoadingRegulatory, setIsLoadingRegulatory] = useState(false);
  const [regulatoryError, setRegulatoryError] = useState<string | null>(null);
  const [ragAnswer, setRagAnswer] = useState<string | null>(null);
  const [isRagLoading, setIsRagLoading] = useState(false);
  const [ragError, setRagError] = useState<string | null>(null);
  const [ohioTdddDecision, setOhioTdddDecision] =
    useState<OhioTdddDecision | null>(null);
  const [ohioTdddLoading, setOhioTdddLoading] = useState(false);
  const [ohioTdddError, setOhioTdddError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copilotResponse, setCopilotResponse] =
    useState<PractitionerFormCopilotResponse | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [lastEvaluatedPayload, setLastEvaluatedPayload] = useState<string | null>(
    null
  );
  const [decisionSnapshotId, setDecisionSnapshotId] = useState<string | null>(
    null
  );
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // --- NEW: inline controlled-substance item helper state ---
  const [itemQuery, setItemQuery] = useState("");
  const [itemResult, setItemResult] = useState<ItemHistory | null>(null);
  const [itemLoading, setItemLoading] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);
  const [itemRagAnswer, setItemRagAnswer] = useState<string | null>(null);
  const [itemRagError, setItemRagError] = useState<string | null>(null);

  useEffect(() => {
    if (!API_BASE) {
      setApiBaseError(
        "Sandbox misconfigured: missing API base URL. Please set VITE_API_BASE in your environment before using Practitioner CSF tools."
      );
    } else {
      setApiBaseError(null);
    }
  }, [API_BASE]);

  function applyPractitionerExample(example: PractitionerCsfExample) {
    setSelectedExampleId(example.id);
    setForm(example.formData);
    setControlledSubstances(example.formData.controlledSubstances ?? []);

    emitCodexCommand("csf_practitioner_example_selected", {
      example_id: example.id,
      label: example.label,
      description: example.description,
      form: example.formData,
      controlled_substances: example.formData.controlledSubstances ?? [],
      source_document:
        "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf",
    });
  }

  const onChange = (field: keyof PractitionerCsfFormData, value: any) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!API_BASE) {
      setApiBaseError(
        "Sandbox misconfigured: missing API base URL. Please set VITE_API_BASE in your environment before using Practitioner CSF tools."
      );
      return;
    }

    setApiBaseError(null);

    const isLocal =
      API_BASE.includes("127.0.0.1") || API_BASE.includes("localhost");

    setIsLoading(true);
    setError(null);
    setVerificationError(null);
    setHistoryError(null);
    setDecision(null);
    setDecisionSnapshotId(null);
    setLastEvaluatedPayload(null);
    setExplanation(null);
    setExplainError(null);
    setRagAnswer(null);
    setRagError(null);

    try {
      const normalizedPayload = JSON.stringify(
        buildPractitionerCsfPayload(form)
      );
      const evalJson = await callPractitionerEvaluate(API_BASE, form);
      const result = (evalJson as any).verdict ?? evalJson;
      setDecision(result);

      setLastEvaluatedPayload(normalizedPayload);

      emitCodexCommand("evaluate_csf_practitioner", {
        form,
        decision: result,
        source_document: CSF_PRACTITIONER_SOURCE_DOCUMENT,
      });

      // --- NEW: snapshot into decision history ---
      let snapshotId: string | undefined;

      if (!isLocal) {
        try {
          const regulatoryReferenceIds = Array.isArray(result.regulatory_references)
            ? result.regulatory_references
            : [];

          const snapResp = await fetch(`${API_BASE}/decisions/history`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              engine_family: "csf",
              decision_type: "csf_practitioner",
              status: result.status,
              jurisdiction: form.shipToState,
              regulatory_reference_ids: regulatoryReferenceIds,
              source_documents: [CSF_PRACTITIONER_SOURCE_DOCUMENT],
              payload: {
                form,
                decision: result,
              },
            }),
          });

          if (!snapResp.ok) {
            const errText = await snapResp.text().catch(() => "");
            console.error(
              "Failed to snapshot CSF practitioner decision",
              snapResp.status,
              errText,
            );
            setHistoryError(
              "Could not save decision history snapshot (this will not block your request)."
            );
          } else {
            const snapBody = await snapResp.json();
            snapshotId = (snapBody as any).id;
            setDecisionSnapshotId(snapshotId ?? null);
          }
        } catch (err) {
          console.error("Failed to snapshot CSF practitioner decision", err);
          setHistoryError(
            "Could not save decision history snapshot (this will not block your request)."
          );
        }
      }

      // --- NEW: create verification request when not ok_to_ship/allowed ---
      const decisionStatus = result.status ?? (result as any).outcome;
      const needsVerification =
        result.status && !["ok_to_ship", "allowed"].includes(result.status);

      if (needsVerification && !isLocal) {
        if (!snapshotId) {
          console.warn(
            "Result is not allowed but no snapshotId was created; skipping verification submit.",
          );
        } else {
          try {
            const regulatoryReferenceIds = Array.isArray(
              result.regulatory_references
            )
              ? result.regulatory_references
              : [];

            const verifyResp = await fetch(`${API_BASE}/verifications/submit`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                engine_family: "csf",
                decision_type: "csf_practitioner",
                jurisdiction: form.shipToState,
                reason_for_review:
                  result.status === "manual_review"
                    ? "manual_review"
                    : "csf_practitioner_blocked",
                decision_snapshot_id: snapshotId,
                regulatory_reference_ids: regulatoryReferenceIds,
                source_documents: [CSF_PRACTITIONER_SOURCE_DOCUMENT],
                user_question: null,
                channel: "web_sandbox",
                payload: {
                  form,
                  decision: result,
                },
              }),
            });

            if (!verifyResp.ok) {
              const errText = await verifyResp.text().catch(() => "");
              console.error(
                "Failed to submit CSF practitioner verification request",
                verifyResp.status,
                errText,
              );
              setVerificationError(
                "Verification request failed. Please try again or contact support if this persists."
              );
            } else {
              emitCodexCommand("verification_request_created", {
                engine_family: "csf",
                decision_type: "csf_practitioner",
                status: result.status,
                decision_snapshot_id: snapshotId,
                source_document: CSF_PRACTITIONER_SOURCE_DOCUMENT,
              });
            }
          } catch (err) {
            console.error(
              "Failed to submit CSF practitioner verification request",
              err,
            );
            setVerificationError(
              "Verification request failed. Please try again or contact support if this persists."
            );
          }
        }
      }
      // --- END NEW ---
    } catch (err: any) {
      setError(err?.message ?? "Failed to evaluate Practitioner CSF");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setForm(initialForm);
    setDecision(null);
    setError(null);
    setVerificationError(null);
    setHistoryError(null);
    setControlledSubstances([]);
    setExplanation(null);
    setExplainError(null);
    setIsExplaining(false);

    setRagAnswer(null);
    setRagError(null);
    setIsRagLoading(false);

    setCopilotLoading(false);
    setCopilotResponse(null);
    setCopilotError(null);
    setLastEvaluatedPayload(null);
    setDecisionSnapshotId(null);

    setRegulatoryArtifacts([]);
    setRegulatoryError(null);
    setIsLoadingRegulatory(false);

    setOhioTdddDecision(null);
    setOhioTdddError(null);
    setOhioTdddLoading(false);

    setItemQuery("");
    setItemResult(null);
    setItemLoading(false);
    setItemError(null);
    setItemRagAnswer(null);
    setItemRagError(null);
    setNotice(null);
    setSelectedExampleId("primary_care");
  };

  async function handleOhioTdddCheck() {
    if ((form as any).shipToState && (form as any).shipToState !== "OH") {
      setOhioTdddError(
        "Ohio TDDD license check is primarily relevant when ship-to state is OH."
      );
      setOhioTdddDecision(null);
      return;
    }

    setOhioTdddLoading(true);
    setOhioTdddError(null);
    setOhioTdddDecision(null);

    const payload: OhioTdddFormData = mapPractitionerFormToOhioTddd(form);

    trackSandboxEvent("license_ohio_tddd_from_practitioner_csf_attempt", {
      engine_family: "license",
      decision_type: "license_ohio_tddd",
      sandbox: "practitioner_csf",
      ship_to_state: payload.shipToState,
    });

    try {
      const result = await evaluateOhioTdddLicense(payload);
      setOhioTdddDecision(result);

      trackSandboxEvent("license_ohio_tddd_from_practitioner_csf_success", {
        engine_family: "license",
        decision_type: "license_ohio_tddd",
        sandbox: "practitioner_csf",
        status: result.status,
      });
    } catch (err: any) {
      const message =
        err?.message ??
        "Ohio TDDD license evaluation could not run. Please try again.";
      setOhioTdddError(message);

      trackSandboxEvent("license_ohio_tddd_from_practitioner_csf_error", {
        engine_family: "license",
        decision_type: "license_ohio_tddd",
        sandbox: "practitioner_csf",
        error: String(err),
      });
    } finally {
      setOhioTdddLoading(false);
    }
  }

  const handleExplain = async () => {
    if (!decision || apiBaseError) return;

    setIsExplaining(true);
    setExplainError(null);

    const summary: CsfDecisionSummary = {
      status: decision.status,
      reason: decision.reason,
      missing_fields: decision.missing_fields ?? [],
      regulatory_references: decision.regulatory_references ?? [],
    };

    try {
      const res = await explainCsfDecision("practitioner", summary);
      setExplanation(res.explanation);
    } catch (err: any) {
      setExplainError(
        err?.message ?? "Failed to generate CSF decision explanation"
      );
    } finally {
      setIsExplaining(false);
    }
  };

  const runFormCopilot = async () => {
    if (!API_BASE) {
      setApiBaseError(
        "Sandbox misconfigured: missing API base URL. Please set VITE_API_BASE in your environment before using Practitioner CSF tools."
      );
      return;
    }

    const normalizedPayload = JSON.stringify(buildPractitionerCsfPayload(form));

    setApiBaseError(null);
    setCopilotLoading(true);
    setVerificationError(null);
    setCopilotError(null);
    setCopilotResponse(null);

    try {
      const copilotResult = await callPractitionerFormCopilot(
        form,
        controlledSubstances
      );

      setCopilotResponse(copilotResult);
      setDecision({
        status: copilotResult.status,
        reason: copilotResult.reason,
        missing_fields: copilotResult.missing_fields,
        regulatory_references: copilotResult.regulatory_references,
      });
      setLastEvaluatedPayload(normalizedPayload);
      setNotice(null);

      emitCodexCommand("csf_practitioner_form_copilot_run", {
        engine_family: "csf",
        decision_type: "csf_practitioner",
        decision_outcome: copilotResult.status ?? "unknown",
      });

      emitCodexCommand("csf_practitioner_form_copilot_complete", {
        engine_family: "csf",
        decision_type: "csf_practitioner",
        decision_outcome: copilotResult.status ?? "unknown",
        artifacts_used: copilotResult.artifacts_used,
      });
    } catch (err: any) {
      console.error("Form Copilot failed for Practitioner CSF", err);
      const statusPart = (err as any)?.status
        ? ` (status ${(err as any).status})`
        : "";

      setCopilotError(
        `Form Copilot could not run${statusPart}. Please check the form and try again.`,
      );
      emitCodexCommand("csf_practitioner_form_copilot_error", {
        message: String(err?.message || err),
        status: (err as any)?.status ?? undefined,
      });
    } finally {
      setCopilotLoading(false);
    }
  };

  const lookupItemHistory = async () => {
    const q = itemQuery.trim();
    if (!q) return;
    if (!API_BASE) {
      setApiBaseError(
        "Sandbox misconfigured: missing API base URL. Please set VITE_API_BASE in your environment before using Practitioner CSF tools."
      );
      return;
    }
    setApiBaseError(null);
    setItemLoading(true);
    setItemError(null);
    setItemResult(null);
    setItemRagAnswer(null);
    setItemRagError(null);

    try {
      const resp = await fetch(
        `${API_BASE}/controlled-substances/item-history/search?` +
          new URLSearchParams({ query: q, limit: "1" })
      );
      if (!resp.ok) {
        throw new Error(`Item history search failed: ${resp.status}`);
      }
      const data = (await resp.json()) as ItemHistory[];
      const first = data[0] ?? null;
      setItemResult(first);

      emitCodexCommand("cs_practitioner_item_history_lookup", {
        query: q,
        found: !!first,
        engine_family: "csf",
        decision_type: "csf_practitioner",
      });

      if (!first) {
        setItemError("No item history found for that query.");
      }
    } catch (err) {
      console.error(err);
      setItemError("Failed to search item history.");
    } finally {
      setItemLoading(false);
    }
  };

  const explainItemWithRag = async () => {
    if (!itemResult) return;
    if (!API_BASE) {
      setApiBaseError(
        "Sandbox misconfigured: missing API base URL. Please set VITE_API_BASE in your environment before using Practitioner CSF tools."
      );
      return;
    }

    setApiBaseError(null);
    setItemRagAnswer(null);
    setItemRagError(null);
    try {
      const decisionPayload = {
        item_id: itemResult.item_id,
        name: itemResult.name,
        dea_schedule: itemResult.dea_schedule,
        last_ship_to_state: itemResult.last_ship_to_state,
        last_decision_status: itemResult.last_decision_status,
        total_orders_12m: itemResult.total_orders_12m,
        verification_flags: itemResult.verification_flags,
      };

      const data = await callRegulatoryRag({
        question:
          "Explain what controlled-substance licenses or forms are required to ship this item to the given state, and how CSF / Ohio TDDD / PDMA flows apply.",
        decision: decisionPayload,
        regulatory_references: [], // let backend pick relevant rules/docs
      });
      const answer =
        (data.answer as string) ??
        (data.text as string) ??
        JSON.stringify(data, null, 2);

      setItemRagAnswer(answer);

      emitCodexCommand("cs_practitioner_item_rag_explained", {
        item_id: itemResult.item_id,
        engine_family: "csf",
        decision_type: "csf_practitioner",
      });
    } catch (err) {
      console.error("Item RAG explain failed", err);
      setItemRagError("Deep regulatory explain is temporarily unavailable.");
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (!decision || !decision.regulatory_references?.length) {
      setRegulatoryArtifacts([]);
      setRegulatoryError(null);
      setIsLoadingRegulatory(false);
      return;
    }

    const refs = decision.regulatory_references;

    setIsLoadingRegulatory(true);
    setRegulatoryError(null);

    (async () => {
      try {
        const all = await fetchComplianceArtifacts();
        if (cancelled) return;

        const byId = new Map(all.map((a) => [a.id, a]));
        const relevant: ComplianceArtifact[] = [];

        for (const id of refs) {
          const art = byId.get(id);
          if (art) {
            relevant.push(art);
          }
        }

        setRegulatoryArtifacts(relevant);
      } catch (err: any) {
        if (cancelled) return;
        setRegulatoryError(
          err?.message ?? "Failed to load regulatory artifacts for this decision."
        );
      } finally {
        if (cancelled) return;
        setIsLoadingRegulatory(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [decision]);

  const copilotArtifactsUsed = copilotResponse?.artifacts_used ?? [];
  const copilotRegulatoryReferences = (
    copilotResponse?.regulatory_references ?? []
  ).filter(
    (ref, idx, arr) =>
      arr.indexOf(ref) === idx && !copilotArtifactsUsed.includes(ref)
  );
  const copilotRagSources = (copilotResponse?.rag_sources ?? [])
    .map((source: PractitionerFormCopilotResponse["rag_sources"][number]) =>
      source.title || source.url || JSON.stringify(source)
    )
    .filter(
      (src, idx, arr) =>
        arr.indexOf(src) === idx && !copilotArtifactsUsed.includes(src)
    );

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3 text-[11px] shadow-sm">
      {apiBaseError && (
        <div className="mb-2">
          <ErrorAlert message={apiBaseError} />
        </div>
      )}
      <header className="mb-2 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-700">
            Practitioner CSF Sandbox
          </h2>
          <p className="text-[10px] text-gray-500">
            Test practitioner controlled substance forms end-to-end.
          </p>
          <div className="mt-1">
            <TestCoverageNote
              size="sm"
              files={["backend/tests/test_csf_practitioner_api.py"]}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SourceDocumentChip
            label="Practitioner CSF PDF"
            url="/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf"
          />
          <button
            type="button"
            onClick={reset}
            className="text-[10px] text-gray-500 hover:underline"
          >
            Reset
          </button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Left: form + results */}
        <div className="space-y-3">
          <section className="mt-3">
            <p className="text-xs font-medium text-slate-300">
              Realistic practitioner examples
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Use these presets when you&apos;re demoing the Practitioner CSF engine:
              primary care, pain management, and telehealth-only prescribing.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRACTITIONER_EXAMPLES.map((example) => {
                const isActive = example.id === selectedExampleId;
                return (
                  <button
                    key={example.id}
                    type="button"
                    onClick={() => applyPractitionerExample(example)}
                    className={[
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium transition",
                      isActive
                        ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                        : "border-slate-700 bg-slate-900/80 text-slate-200 hover:border-slate-500 hover:bg-slate-800",
                    ].join(" ")}
                  >
                    <span>{example.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {
                PRACTITIONER_EXAMPLES.find((ex) => ex.id === selectedExampleId)
                  ?.description
              }
            </div>
          </section>

          <form onSubmit={onSubmit} className="space-y-3">
            {/* Facility info */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Facility name
                </label>
                <input
                  type="text"
                  value={form.facilityName}
                  onChange={(e) => onChange("facilityName", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Facility type
                </label>
                <select
                  value={form.facilityType}
                  onChange={(e) =>
                    onChange("facilityType", e.target.value as PractitionerFacilityType)
                  }
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                >
                  <option value="dental_practice">Dental practice</option>
                  <option value="individual_practitioner">Individual practitioner</option>
                  <option value="group_practice">Group practice</option>
                  <option value="clinic">Clinic</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Account #
                </label>
                <input
                  type="text"
                  value={form.accountNumber ?? ""}
                  onChange={(e) => onChange("accountNumber", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Ship-to state
                </label>
                <input
                  type="text"
                  value={form.shipToState}
                  onChange={(e) => onChange("shipToState", e.target.value.toUpperCase())}
                  maxLength={2}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs uppercase"
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.attestationAccepted}
                    onChange={(e) =>
                      onChange("attestationAccepted", e.target.checked)
                    }
                  />
                  <span>I accept the CSF attestation clause</span>
                </label>
              </div>
            </div>

            {/* Practitioner & licensing */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Practitioner name
                </label>
                <input
                  type="text"
                  value={form.practitionerName}
                  onChange={(e) => onChange("practitionerName", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  State license #
                </label>
                <input
                  type="text"
                  value={form.stateLicenseNumber}
                  onChange={(e) => onChange("stateLicenseNumber", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  DEA #
                </label>
                <input
                  type="text"
                  value={form.deaNumber}
                  onChange={(e) => onChange("deaNumber", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
            </div>

            {/* Internal notes */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Internal notes (optional)
              </label>
              <textarea
                value={form.internalNotes ?? ""}
                onChange={(e) => onChange("internalNotes", e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                rows={2}
              />
            </div>

            {/* --- NEW: Controlled Substances Item Helper --- */}
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-[11px] font-semibold text-slate-800">
                    Controlled Substances – Item (optional)
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Look up a controlled item by ID (NDC/SKU) or name to see DEA
                    schedule, recent decisions, and flags while filling this
                    form.
                  </p>
                </div>
              </div>

              <div className="mb-2 flex items-center gap-1">
                <input
                  type="text"
                  value={itemQuery}
                  onChange={(e) => setItemQuery(e.target.value)}
                  placeholder="e.g. NDC-55555-0101 or Hydrocodone"
                  className="h-7 flex-1 rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                />
                <button
                  type="button"
                  onClick={lookupItemHistory}
                  disabled={itemLoading || !!apiBaseError}
                  title={
                    apiBaseError ? "Disabled: missing API base URL." : undefined
                  }
                  className="h-7 rounded-md bg-slate-900 px-3 text-[11px] font-medium text-slate-50 hover:bg-slate-800 disabled:opacity-50"
                >
                  {itemLoading ? "Searching…" : "Lookup"}
                </button>
              </div>

              {itemError && (
                <p className="mb-1 text-[10px] text-rose-600">{itemError}</p>
              )}

              {itemResult && (
                <div className="rounded-md border border-slate-200 bg-white p-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono font-semibold text-slate-900">
                        {itemResult.item_id}
                      </span>
                      <span className="text-[10px] text-slate-700">
                        {itemResult.name}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-medium text-rose-800">
                        Schedule {itemResult.dea_schedule}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-800">
                        Last decision: {itemResult.last_decision_status}
                      </span>
                    </div>
                  </div>

                  <div className="mb-1 flex items-center justify-between gap-2 text-[9px] text-slate-600">
                    <span>
                      Last purchase:{" "}
                      <strong className="text-slate-800">
                        {itemResult.last_purchase_date}
                      </strong>
                    </span>
                    <span>
                      Ship-to:{" "}
                      <strong className="text-slate-800">
                        {itemResult.last_ship_to_state}
                      </strong>
                    </span>
                    <span>
                      12m orders:{" "}
                      <strong className="text-slate-800">
                        {itemResult.total_orders_12m}
                      </strong>
                    </span>
                  </div>

                  {itemResult.verification_flags?.length > 0 && (
                    <div className="mb-1 flex flex-wrap items-center gap-1">
                      {itemResult.verification_flags.map((f) => (
                        <span
                          key={f}
                          className="rounded-full bg-slate-50 px-2 py-0.5 text-[9px] text-slate-700 ring-1 ring-slate-300"
                        >
                          {f.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}

                  {itemResult.source_documents?.length > 0 && (
                    <div className="mb-1 flex flex-wrap items-center gap-1">
                      {itemResult.source_documents.slice(0, 2).map((doc) => (
                        <a
                          key={doc}
                          href={doc}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() =>
                            emitCodexCommand(
                              "cs_practitioner_item_history_document_opened",
                              {
                                item_id: itemResult.item_id,
                                source_document: doc, // /mnt/data/... path
                              }
                            )
                          }
                          className="rounded-full bg-white px-2 py-0.5 text-[9px] text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
                        >
                          Open doc
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={explainItemWithRag}
                      disabled={!!apiBaseError}
                      title={
                        apiBaseError ? "Disabled: missing API base URL." : undefined
                      }
                      className="rounded-full bg-slate-900 px-3 py-0.5 text-[9px] text-slate-50 hover:bg-slate-800 disabled:opacity-50"
                    >
                      Explain this item with RAG
                    </button>
                  </div>

                  {itemRagError && <ErrorAlert message={itemRagError} />}

                  {itemRagAnswer && (
                    <div className="mt-1 rounded bg-slate-50 p-2 text-[9px] leading-snug text-slate-800">
                      <strong className="mb-1 block text-[9px] text-slate-600">
                        RAG explanation
                      </strong>
                      <p className="whitespace-pre-wrap">{itemRagAnswer}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={isLoading || !!apiBaseError}
                title={apiBaseError ? "Disabled: missing API base URL." : undefined}
                className="rounded-md bg-blue-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? "Evaluating…" : "Evaluate Practitioner CSF"}
              </button>

              <CopyCurlButton
                label="Copy cURL (evaluate)"
                getCommand={() =>
                  buildCurlCommand("/csf/practitioner/evaluate", form)
                }
              />
            </div>
          </form>

          {/* Result & error */}
          <div className="space-y-2 text-xs">
            {error && (
              <div className="rounded-md bg-red-50 px-2 py-1 text-red-700">
                {error}
              </div>
            )}

            {verificationError && <ErrorAlert message={verificationError} />}

            {historyError && (
              <ErrorAlert
                tone="warning"
                message={historyError}
              />
            )}

            {decision && (
              <div className="rounded-md bg-gray-50 px-3 py-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                    Decision
                  </span>
                  <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-medium text-white">
                    {decision.status}
                  </span>
                </div>
                <p className="text-[11px] text-gray-800">{decision.reason}</p>

                {decision.missing_fields.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[11px] font-medium text-gray-700">
                      Missing fields
                    </div>
                    <ul className="list-inside list-disc text-[11px] text-gray-700">
                      {decision.missing_fields.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Explain decision via /csf/explain */}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isExplaining || !!apiBaseError}
                      title={
                        apiBaseError ? "Disabled: missing API base URL." : undefined
                      }
                      className="rounded-md bg-slate-700 px-3 py-1 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                      onClick={handleExplain}
                    >
                      {isExplaining ? "Explaining…" : "Explain decision"}
                    </button>

                    <CopyCurlButton
                      label="Copy cURL (explain)"
                      getCommand={() =>
                        buildCurlCommand("/csf/explain", { decision })
                      }
                    />
                  </div>

                  {explainError && (
                    <div className="rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700">
                      {explainError}
                    </div>
                  )}

                  {explanation && (
                    <pre className="whitespace-pre-wrap rounded-md bg-white px-2 py-2 text-[11px] text-gray-800 ring-1 ring-gray-200">
                      {explanation}
                    </pre>
                  )}
                </div>

                {/* NEW: Deep RAG explain via /rag/regulatory-explain */}
                <div className="mt-3 space-y-1 border-t border-gray-200 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-gray-700">
                      Deep RAG explain (experimental)
                    </span>
                    {isRagLoading && (
                      <span className="text-[10px] text-gray-400">Running RAG…</span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isRagLoading || !decision || !!apiBaseError}
                    title={
                      apiBaseError ? "Disabled: missing API base URL." : undefined
                    }
                    className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={async () => {
                      if (!decision) return;

                      setIsRagLoading(true);
                      setRagError(null);
                      setRagAnswer(null);

                      const question =
                        "Explain this practitioner controlled substance form decision using the referenced regulatory artifacts. " +
                        "Focus on why the status is '" +
                        decision.status +
                        "' and how the Florida addendum or base form apply, if relevant.";

                      try {
                        const res = await callRegulatoryRag({
                          question,
                          regulatory_references: decision.regulatory_references ?? [],
                          decision,
                        });

                        setRagAnswer(res.answer);

                        // Optional: log a Codex command for DevSupport
                        emitCodexCommand(
                          "rag_regulatory_explain_practitioner",
                          {
                            question,
                            regulatory_references: decision.regulatory_references ?? [],
                            decision,
                            controlled_substances: controlledSubstances,
                          }
                        );
                      } catch (err: any) {
                        console.error("Deep RAG explain failed", err);
                        setRagError(
                          "Deep regulatory explain is temporarily unavailable."
                        );
                      } finally {
                        setIsRagLoading(false);
                      }
                    }}
                  >
                    {isRagLoading ? "Running RAG…" : "Deep RAG explain"}
                  </button>

                  {ragError && (
                    <ErrorAlert message={ragError} />
                  )}

                  {ragAnswer && (
                    <pre className="whitespace-pre-wrap rounded-md bg-white px-2 py-2 text-[11px] text-gray-800 ring-1 ring-gray-200">
                      {ragAnswer}
                    </pre>
                  )}
                </div>

                {/* Regulatory basis pills */}
                {decision.regulatory_references?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-gray-700">
                        Regulatory basis
                      </span>
                      {isLoadingRegulatory && (
                        <span className="text-[10px] text-gray-400">Loading…</span>
                      )}
                    </div>

                    {regulatoryError && (
                      <div className="rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700">
                        {regulatoryError}
                      </div>
                    )}

                    {!regulatoryError &&
                      regulatoryArtifacts.length === 0 &&
                      !isLoadingRegulatory && (
                        <div className="text-[11px] text-gray-400">
                          No matching artifacts found for:{" "}
                          {decision.regulatory_references.join(", ")}.
                        </div>
                      )}

                    {regulatoryArtifacts.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {regulatoryArtifacts.map((art) => (
                          <span
                            key={art.id}
                            className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-800 ring-1 ring-indigo-100"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                            <span>{art.name}</span>
                            <span className="text-[9px] text-indigo-500">
                              [{art.jurisdiction}]
                            </span>
                            {art.source_document && (
                              <span className="text-[9px] text-indigo-400">({art.id})</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Hook for Codex in a later step */}
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
                    onClick={() => {
                      emitCodexCommand(
                        "explain_csf_practitioner_decision",
                        {
                          form,
                          decision,
                          controlled_substances: controlledSubstances,
                          source_document:
                            "/mnt/data/Online Controlled Substance Form - Practitioner Form with addendums.pdf",
                        }
                      );
                    }}
                  >
                    Ask Codex to explain decision
                  </button>
                  <span className="text-[10px] text-gray-400">
                  Future: narrative explanation for support/compliance.
                  </span>
                </div>
              </div>
            )}

            <section className="sandbox-section sandbox-section--ohio-tddd">
              <h3>Ohio TDDD License Check (Optional)</h3>
              <p className="sandbox-helper">
                Validate Ohio TDDD license information for this Practitioner
                CSF. This is most relevant when <code>ship-to state = OH</code>.
              </p>

              <div className="sandbox-actions">
                <button
                  type="button"
                  onClick={handleOhioTdddCheck}
                  disabled={ohioTdddLoading}
                >
                  {ohioTdddLoading
                    ? "Checking Ohio TDDD..."
                    : "Run Ohio TDDD license check"}
                </button>
                <a href="/license/ohio-tddd" target="_blank" rel="noreferrer">
                  Open full Ohio TDDD License Sandbox
                </a>
              </div>

              {ohioTdddError && <p className="error">{ohioTdddError}</p>}

              {ohioTdddDecision && (
                <div className="decision-panel decision-panel--ohio-tddd">
                  <p>
                    <strong>Ohio TDDD status:</strong> {ohioTdddDecision.status}
                  </p>
                  <p>
                    <strong>Reason:</strong> {ohioTdddDecision.reason}
                  </p>
                  {ohioTdddDecision.missingFields?.length > 0 && (
                    <p>
                      <strong>Missing fields:</strong>{" "}
                      {ohioTdddDecision.missingFields.join(", ")}
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* ---- Form Copilot (beta) ---- */}
            <section className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
              <header className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-[11px] font-semibold text-slate-800">
                    Form Copilot (beta)
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Runs the CSF decision engine on the current form and asks the regulatory RAG service to explain what's allowed or blocked, plus what's missing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={runFormCopilot}
                  disabled={copilotLoading || !!apiBaseError}
                  title={
                    apiBaseError ? "Disabled: missing API base URL." : undefined
                  }
                  className="h-7 rounded-md bg-slate-900 px-3 text-[11px] font-medium text-slate-50 hover:bg-slate-800 disabled:opacity-50"
                >
                  {copilotLoading ? "Checking…" : "Check & Explain"}
                </button>
              </header>

              {notice && (
                <p className="mb-1 text-[10px] text-amber-700">{notice}</p>
              )}

              {copilotError && (
                <p className="text-red-600 text-sm">
                  Form Copilot could not run. Please check the form and try again.
                </p>
              )}

              {copilotResponse && (
                <FormCopilotDetailsCard
                  title="Practitioner CSF Copilot explanation"
                  status={copilotResponse.status}
                  reason={copilotResponse.reason}
                  missingFields={copilotResponse.missing_fields ?? []}
                  regulatoryReferences={copilotRegulatoryReferences}
                  ragExplanation={copilotResponse.rag_explanation ?? null}
                  artifactsUsed={copilotArtifactsUsed}
                  ragSources={copilotRagSources}
                />
              )}

              {!copilotResponse && !copilotLoading && !copilotError && (
                <p className="text-[10px] text-slate-400">
                  Click <span className="font-semibold">“Check &amp; Explain”</span>{" "}
                  to have AutoComply run the CSF engine on your current form and summarize what it thinks, including missing licenses or issues.
                </p>
              )}
            </section>
          </div>
        </div>

        {/* Right: Controlled Substances panel */}
        <ControlledSubstancesPanel
          accountNumber={form.accountNumber ?? ""}
          value={controlledSubstances}
          onChange={setControlledSubstances}
        />
      </div>
    </section>
  );
}
