import React from "react";
import { ShieldCheck, Activity, Bug } from "lucide-react";

function BulletRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-xl bg-slate-900">
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-100">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">
          {body}
        </p>
      </div>
    </div>
  );
}

export function TestingReliabilityCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-100 shadow-md shadow-black/30 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-50">
            Testing &amp; reliability
          </h2>
          <p className="mt-1 text-[11px] text-slate-400">
            How AutoComply AI keeps its CSF, license, and mock order engines
            honest before you ever hit a browser.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-200 border border-emerald-500/40">
          <ShieldCheck className="h-3 w-3" />
          <span>Guard rails</span>
        </span>
      </div>

      <div className="mt-3 space-y-3">
        <BulletRow
          icon={<Activity className="h-3.5 w-3.5 text-cyan-200" />}
          title="Backend test suite (pytest)"
          body={
            "Core decision logic is covered by pytest so changes to CSF, license, and order engines can be validated with a single command: `pytest backend/tests`."
          }
        />

        <BulletRow
          icon={<Bug className="h-3.5 w-3.5 text-amber-200" />}
          title="HTTP smoke tests"
          body={
            "A lightweight script, `python scripts/smoke_test_autocomply.py --base-url http://localhost:8000`, calls key endpoints like /health, /csf/hospital/evaluate, and license/order mocks to catch wiring issues early."
          }
        />

        <BulletRow
          icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-200" />}
          title="CI pipeline (GitHub Actions)"
          body={
            "The AutoComply AI – CI workflow runs installs, pytest, and smoke tests on every push so the demo stays stable even as you keep evolving the product."
          }
        />
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        In interviews, you can open this section, mention pytest + smoke tests,
        and then jump into dev traces to show how failures would actually look
        in real traffic.
      </p>
    </div>
  );
}
