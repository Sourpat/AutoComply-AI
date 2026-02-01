export type NavItem = {
  to: string;
  label: string;
  group: "primary" | "suites" | "more" | "admin";
  exact?: boolean;
};

export const navConfig: NavItem[] = [
  { to: "/", label: "Home", group: "primary", exact: true },
  { to: "/chat", label: "Chat", group: "primary" },
  { to: "/console", label: "Console", group: "primary" },
  { to: "/admin/review", label: "Review Queue", group: "admin" },
  { to: "/agentic/workbench", label: "Agentic Workbench", group: "admin" },
  { to: "/admin/ops", label: "Ops", group: "admin" },
  { to: "/csf", label: "CSF Suite", group: "suites" },
  { to: "/license", label: "License Suite", group: "suites" },
  { to: "/coverage", label: "Coverage", group: "more" },
  { to: "/governance/narrative", label: "Governance Narrative", group: "more" },
  { to: "/analytics", label: "Analytics", group: "more" },
];

export function isGovNarrativeEnabled(): boolean {
  const metaEnv = (import.meta as any)?.env ?? {};
  return metaEnv.VITE_FEATURE_GOV_NARRATIVE === "true";
}

export function isAdminUnlocked(): boolean {
  const metaEnv = (import.meta as any)?.env ?? {};
  const enableReviewQueue = metaEnv.VITE_ENABLE_REVIEW_QUEUE;
  const enableOps = metaEnv.VITE_ENABLE_OPS;

  if (enableReviewQueue === "false" || enableReviewQueue === "0") return false;
  if (enableOps === "false" || enableOps === "0") return false;

  if (enableReviewQueue === "true" || enableReviewQueue === "1") return true;
  if (enableOps === "true" || enableOps === "1") return true;

  if (localStorage.getItem("admin_unlocked") === "true") return true;

  return true;
}
