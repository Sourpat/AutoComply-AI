import { emitCodexCommand } from "../utils/codexLogger";

type FlowDiagram = {
  id: string;
  label: string;
  description?: string;
  url: string; // NOTE: this will be a /mnt/data/... path
};

const FLOW_DIAGRAMS: FlowDiagram[] = [
  {
    id: "csf_user_flow",
    label: "Controlled Substances – User Flow (v1)",
    description:
      "High-level user journey through the controlled substances form workflow.",
    url: "/mnt/data/Controlledsubstance_userflow.png",
  },
  {
    id: "csf_flow_updated",
    label: "Controlled Substances – Form Flow (Updated)",
    description:
      "Updated controlled substances form flow including decision and review steps.",
    url: "/mnt/data/Controlled_Substances_Form_Flow_Updated.png",
  },
];

export function RegulatoryFlowsPanel() {
  const handleOpen = (flow: FlowDiagram) => {
    emitCodexCommand("open_regulatory_flow_diagram", {
      flow_id: flow.id,
      label: flow.label,
      description: flow.description,
      url: flow.url, // /mnt/data/... path, treated as URL by the runtime
    });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <header className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[11px] font-semibold text-slate-800">
            Regulatory Flows & Diagrams
          </h2>
          <p className="text-[10px] text-slate-500">
            Click to open controlled substances flow diagrams (served from
            /mnt/data/…).
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        {FLOW_DIAGRAMS.map((flow) => (
          <article
            key={flow.id}
            className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"
          >
            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-slate-900">
                {flow.label}
              </span>
              {flow.description && (
                <span className="text-[10px] text-slate-500">
                  {flow.description}
                </span>
              )}
              <span className="text-[9px] font-mono text-slate-400">
                {flow.url}
              </span>
            </div>

            <a
              href={flow.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => handleOpen(flow)}
              className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
            >
              View diagram
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
