import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
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

const CSF_OVERVIEW_CARDS = [
  {
    id: "hospital",
    title: "Hospital CSF Sandbox",
    subtitle:
      "Evaluate hospital pharmacy controlled substance forms with the primary CSF engine.",
    bullets: [
      (
        <>
          • Uses <code>/csf/hospital/evaluate</code> and <code>/csf/hospital/form-copilot</code>.
        </>
      ),
      "• Core sandbox for inpatient pharmacies and IDNs.",
      "• Shows ok_to_ship, needs_review, or blocked decisions with RAG-backed context.",
    ],
    link: "/csf/hospital",
  },
  {
    id: "practitioner",
    title: "Practitioner CSF Sandbox",
    subtitle:
      "Run practitioner CSF payloads, including addendums and controlled substance lookups.",
    bullets: [
      (
        <>
          • Uses <code>/csf/practitioner/evaluate</code> and <code>/csf/practitioner/form-copilot</code>.
        </>
      ),
      "• Mirrors the hospital decision contract for outpatient workflows.",
      "• Helpful for independent prescribers and office-based clinics.",
    ],
    link: "/csf/practitioner",
  },
  {
    id: "facility",
    title: "Facility CSF Sandbox",
    subtitle:
      "Test controlled substance forms for non-hospital facilities using the same regulatory engine as Hospital CSF, but with a facility-specific payload and copy.",
    bullets: [
      (
        <>
          • Uses <code>/csf/facility/evaluate</code> and <code>/csf/facility/form-copilot</code>.
        </>
      ),
      "• Shares the Hospital CSF regulatory doc, but labels responses as “Facility CSF”.",
      "• Good for clinics, long-term care, and other non-hospital sites.",
    ],
    link: "/csf/facility",
  },
  {
    id: "ems",
    title: "EMS CSF Sandbox",
    subtitle:
      "Evaluate EMS medication forms with transport-specific payloads and decisions.",
    bullets: [
      (
        <>
          • Uses <code>/csf/ems/evaluate</code> and <code>/csf/ems/form-copilot</code>.
        </>
      ),
      "• RAG-backed explanations tuned for emergency services.",
      "• Highlights how the CSF engine adapts to EMS workflows.",
    ],
    link: "/csf/ems",
  },
  {
    id: "researcher",
    title: "Researcher CSF Sandbox",
    subtitle:
      "Show R&D teams how CSF applies to lab and research controlled substance requests.",
    bullets: [
      (
        <>
          • Uses <code>/csf/researcher/evaluate</code> and <code>/csf/researcher/form-copilot</code>.
        </>
      ),
      "• Uses the same decision contract with research-specific payloads.",
      "• Demonstrates sandbox flexibility across regulated environments.",
    ],
    link: "/csf/researcher",
  },
];

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
  const { sandboxId } = useParams();

  useEffect(() => {
    trackSandboxEvent("csf_overview_page_view", {
      engine_family: "csf",
      sandbox: "overview",
    });
  }, []);

  useEffect(() => {
    if (!sandboxId) return;

    const section = document.getElementById(`csf-${sandboxId}`);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [sandboxId]);

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
        <div className="grid gap-3 md:grid-cols-2">
          {CSF_OVERVIEW_CARDS.map((card) => (
            <div
              key={card.id}
              className="csf-card space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h3 className="text-sm font-semibold text-slate-900">{card.title}</h3>
              <p className="csf-card-subtitle text-[11px] leading-relaxed text-slate-600">{card.subtitle}</p>
              <ul className="csf-card-bullets space-y-1 text-[11px] leading-relaxed text-slate-700">
                {card.bullets.map((bullet, idx) => (
                  <li key={idx}>{bullet}</li>
                ))}
              </ul>
              <Link to={card.link} className="csf-card-link text-[11px] font-semibold text-sky-600 hover:text-sky-700">
                Open {card.title} →
              </Link>
            </div>
          ))}
        </div>

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
