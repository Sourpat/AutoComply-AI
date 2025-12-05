import React from "react";

interface CopyAsCurlButtonProps {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string; // e.g. "/csf/hospital/evaluate"
  body?: unknown; // JSON-serializable
  traceId?: string | null;
  label?: string;
  className?: string;
}

/**
 * Small helper that builds a curl command for the current origin + given path.
 * It copies the command to the clipboard and shows a temporary "Copied" state.
 */
export const CopyAsCurlButton: React.FC<CopyAsCurlButtonProps> = ({
  method,
  path,
  body,
  traceId,
  label = "Copy as cURL",
  className = "",
}) => {
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleClick = async () => {
    setError(null);

    const origin =
      typeof window !== "undefined" && window.location.origin
        ? window.location.origin
        : "http://localhost:8000";

    const url = `${origin}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (traceId) {
      headers["x-autocomply-trace-id"] = traceId;
    }

    let bodyString = "";
    if (body != null && method !== "GET") {
      try {
        bodyString = JSON.stringify(body, null, 2);
      } catch (e) {
        setError("Could not serialize request body");
        return;
      }
    }

    const headerParts = Object.entries(headers).map(
      ([key, value]) => `-H '${key}: ${value}'`,
    );

    const pieces: string[] = [];
    pieces.push("curl");
    pieces.push(`-X ${method}`);
    pieces.push(headerParts.join(" "));
    if (bodyString) {
      pieces.push(`--data '${bodyString.replace(/'/g, "'\\''")}'`);
    }
    pieces.push(`'${url}'`);

    const command = pieces.join(" ");

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(command);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } else {
        // Fallback: show in console and set error
        console.log("cURL command:", command);
        setError("Clipboard API unavailable; check console for output.");
      }
    } catch (e) {
      setError("Failed to copy cURL command.");
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        className={
          className ||
          "rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] font-medium text-zinc-200 hover:border-blue-500 hover:text-blue-200"
        }
      >
        {copied ? "Copied ✓" : label}
      </button>
      {error && (
        <span className="text-[10px] text-red-400">
          {error}
        </span>
      )}
    </div>
  );
};
