import { useCallback, useEffect, useState } from "react";

export type ApiStatus = "idle" | "checking" | "online" | "offline";

export function useApiHealth(apiBase: string) {
  const [status, setStatus] = useState<ApiStatus>("idle");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const check = useCallback(async () => {
    if (!apiBase) return;

    setStatus("checking");
    try {
      const res = await fetch(`${apiBase}/health`);

      if (res.ok) {
        setStatus("online");
      } else {
        setStatus("offline");
      }
    } catch {
      setStatus("offline");
    } finally {
      setLastChecked(new Date());
    }
  }, [apiBase]);

  useEffect(() => {
    // initial check on mount
    check();

    // optional: auto-refresh every 30s
    const id = window.setInterval(check, 30_000);
    return () => window.clearInterval(id);
  }, [check]);

  return {
    status,
    lastChecked,
    check,
  };
}
