import { useEffect } from "react";
import { EmsCsfSandbox } from "../components/EmsCsfSandbox";
import { FacilityCsfSandbox } from "../components/FacilityCsfSandbox";
import { HospitalCsfSandbox } from "../components/HospitalCsfSandbox";
import { PractitionerCsfSandbox } from "../components/PractitionerCsfSandbox";
import { ResearcherCsfSandbox } from "../components/ResearcherCsfSandbox";
import { trackSandboxEvent } from "../devsupport/telemetry";

type CsfSandboxMeta = {
  id: string;
  title: string;
  description: string;
  evaluateEndpoint: string;
  copilotEndpoint: string;
  ragDocId: string;
  component: JSX.Element;
};

const CSF_SANDBOXES: CsfSandboxMeta[] = [
  {
    id: "hospital",
    title: "Hospital CSF Sandbox",
    description: "Evaluate and explain Hospital Pharmacy Controlled Substance Forms.",
    evaluateEndpoint: "/csf/hospital/evaluate",
    copilotEndpoint: "/csf/hospital/form-copilot",
    ragDocId: "csf_hospital_form",
    component: <HospitalCsfSandbox />,
  },
  {
    id: "practitioner",
    title: "Practitioner CSF Sandbox",
    description:
      "Evaluate and explain Practitioner Controlled Substance Forms (with addendums).",
    evaluateEndpoint: "/csf/practitioner/evaluate",
    copilotEndpoint: "/csf/practitioner/form-copilot",
    ragDocId: "csf_practitioner_form",
    component: <PractitionerCsfSandbox />,
  },
  {
    id: "facility",
    title: "Facility CSF Sandbox",
    description:
      "Evaluate and explain Facility / Surgery Center Controlled Substance Forms.",
    evaluateEndpoint: "/csf/facility/evaluate",
    copilotEndpoint: "/csf/facility/form-copilot",
    ragDocId: "csf_facility_form",
    component: <FacilityCsfSandbox />,
  },
  {
    id: "ems",
    title: "EMS CSF Sandbox",
    description:
      "Evaluate and explain EMS Controlled Substance Forms for emergency medical services.",
    evaluateEndpoint: "/csf/ems/evaluate",
    copilotEndpoint: "/csf/ems/form-copilot",
    ragDocId: "csf_ems_form",
    component: <EmsCsfSandbox />,
  },
  {
    id: "researcher",
    title: "Researcher CSF Sandbox",
    description:
      "Evaluate and explain Researcher Controlled Substance Forms for labs and research teams.",
    evaluateEndpoint: "/csf/researcher/evaluate",
    copilotEndpoint: "/csf/researcher/form-copilot",
    ragDocId: "csf_researcher_form",
    component: <ResearcherCsfSandbox />,
  },
];

export function CsfOverviewPage() {
  useEffect(() => {
    trackSandboxEvent("csf_overview_page_view", {
      engine_family: "csf",
      sandbox: "overview",
    });
  }, []);

  return (
    <div className="space-y-6 py-6">
      <header className="space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            CSF Playground
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Controlled Substance Forms (CSF) – AutoComply AI Playground
          </h1>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-600">
          Explore how AutoComply AI evaluates and explains Controlled Substance Forms across different customer types. Each sandbox
          shares a common decision/RAG engine with its own regulatory document.
        </p>
      </header>

      <div className="space-y-6">
        {CSF_SANDBOXES.map((meta) => (
          <section
            key={meta.id}
            id={`csf-${meta.id}`}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm"
          >
            <div className="space-y-2">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-slate-900">{meta.title}</h2>
                  <p className="text-[11px] text-slate-600">{meta.description}</p>
                </div>
                <a
                  href={`#csf-${meta.id}-sandbox`}
                  className="text-[11px] font-medium text-sky-600 hover:text-sky-700"
                >
                  Jump to {meta.title}
                </a>
              </div>

              <dl className="grid gap-3 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-700 md:grid-cols-3">
                <div className="space-y-0.5">
                  <dt className="font-semibold text-slate-900">Evaluate endpoint</dt>
                  <dd>
                    <code className="rounded bg-white px-2 py-1 text-[10px] ring-1 ring-slate-200">
                      {meta.evaluateEndpoint}
                    </code>
                  </dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="font-semibold text-slate-900">Form Copilot endpoint</dt>
                  <dd>
                    <code className="rounded bg-white px-2 py-1 text-[10px] ring-1 ring-slate-200">
                      {meta.copilotEndpoint}
                    </code>
                  </dd>
                </div>
                <div className="space-y-0.5">
                  <dt className="font-semibold text-slate-900">RAG doc id</dt>
                  <dd>
                    <code className="rounded bg-white px-2 py-1 text-[10px] ring-1 ring-slate-200">{meta.ragDocId}</code>
                  </dd>
                </div>
              </dl>
            </div>

            <div id={`csf-${meta.id}-sandbox`} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {meta.component}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
