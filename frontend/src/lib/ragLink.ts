type RagDetailsOptions = {
  mode?: "connected" | "offline";
  autoload?: boolean;
};

export function ragDetailsUrl(submissionId: string, options: RagDetailsOptions = {}): string {
  const params = new URLSearchParams();
  params.set("mode", options.mode ?? "connected");
  params.set("submission_id", submissionId);
  if (options.autoload) {
    params.set("autoload", "1");
  }
  return `/console/rag?${params.toString()}`;
}
