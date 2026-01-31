export type StatusTone = "info" | "warning" | "success" | "destructive" | "neutral";

export const statusLabels: Record<string, string> = {
  submitted: "Submitted",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
  pending: "Pending",
  blocked: "Blocked",
};

export const statusTones: Record<string, StatusTone> = {
  submitted: "info",
  in_review: "warning",
  approved: "success",
  rejected: "destructive",
  pending: "neutral",
  blocked: "destructive",
};

export function getStatusLabel(status: string) {
  return statusLabels[status] ?? status.replace(/_/g, " ");
}

export function getStatusTone(status: string): StatusTone {
  return statusTones[status] ?? "neutral";
}
