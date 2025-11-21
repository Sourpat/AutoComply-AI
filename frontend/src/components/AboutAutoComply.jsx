import React from "react";

const AboutAutoComply = () => {
  return (
    <section className="w-full rounded-xl border bg-white shadow-sm p-4 md:p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-gray-800">
          About AutoComply AI
        </h2>
        <p className="mt-1 text-xs text-gray-600 leading-relaxed">
          AutoComply AI is a sandbox compliance co-pilot for DEA and state
          license checks. It reimagines a real enterprise controlled
          substance workflow as a modular, AI-ready engine you can demo and
          extend.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg bg-gray-50 border p-3">
          <p className="font-semibold text-gray-800 mb-1">
            1. Validate licenses
          </p>
          <p className="text-gray-600">
            Enter license details manually or upload a PDF. The backend
            runs expiry logic and returns a structured verdict for checkout
            decisions.
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 border p-3">
          <p className="font-semibold text-gray-800 mb-1">
            2. Explain decisions
          </p>
          <p className="text-gray-600">
            Each verdict can include <span className="font-medium">regulatory context</span> –
            DEA and state snippets that explain why a license is allowed,
            near expiry, or blocked.
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 border p-3">
          <p className="font-semibold text-gray-800 mb-1">
            3. Automate workflows
          </p>
          <p className="text-gray-600">
            n8n workflows (email intake, Slack alerts, renewal reminders)
            are ready to connect for a fully automated compliance pipeline.
          </p>
        </div>
      </div>

      <p className="text-[11px] text-gray-500 border-t pt-2">
        This project is a technical portfolio prototype. It is{" "}
        <span className="font-semibold">assistive only</span> and not a
        substitute for legal or regulatory advice.
      </p>
    </section>
  );
};

export default AboutAutoComply;
