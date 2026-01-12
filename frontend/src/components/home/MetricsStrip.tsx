import React from "react";

interface MetricsStripProps {
  backendStatus?: "online" | "offline";
}

export function MetricsStrip({ backendStatus = "online" }: MetricsStripProps) {
  const metrics = [
    { label: "Engines", value: "5", caption: "CSF types" },
    { label: "Journeys", value: "4", caption: "Demo scenarios" },
    { label: "Explainable traces", value: "On", caption: "Audit-ready" },
    {
      label: "Backend",
      value: backendStatus === "online" ? "Online" : "Offline",
      caption: backendStatus === "online" ? "Ready" : "Not connected",
      highlight: true,
    },
  ];

  const getValueColor = (metric: typeof metrics[0]) => {
    if (!metric.highlight) return "text-slate-900";
    return backendStatus === "online"
      ? "text-green-600"
      : "text-red-600";
  };

  return (
    <div className="ac-console__card">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <div key={index} className="text-center">
            <p className="text-sm font-medium text-slate-600 mb-1 uppercase tracking-wide">
              {metric.label}
            </p>
            <p className={`text-2xl font-bold ${getValueColor(metric)} mb-1`}>
              {metric.value}
            </p>
            <p className="text-xs text-slate-600">
              {metric.caption}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
