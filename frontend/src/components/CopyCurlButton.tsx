// src/components/CopyCurlButton.tsx
import React from "react";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "";

type HttpMethod = "GET" | "POST";

interface CopyCurlButtonProps {
  label?: string;
  endpoint: string; // e.g. "/csf/practitioner/evaluate"
  method?: HttpMethod;
  body?: unknown | null;
  disabled?: boolean;
  size?: "xs" | "sm";
}

function buildCurlCommand(
  endpoint: string,
  method: HttpMethod,
  body?: unknown | null
): string {
  const url = `${API_BASE}${endpoint}`;
  const parts: string[] = [`curl -X ${method} "${url}"`];

  if (method === "POST") {
    parts.push('-H "Content-Type: application/json"');
    if (body != null) {
      const json = JSON.stringify(body, null, 2);

      // Escape single quotes for POSIX shell: '...\''...'
      const escaped = json.replace(/'/g, "'\"'\"'");
      parts.push(`-d '${escaped}'`);
    }
  }

  return parts.join(" \\\n  ");
}

export function CopyCurlButton({
  label,
  endpoint,
  method = "POST",
  body,
  disabled,
  size = "xs",
}: CopyCurlButtonProps) {
  const handleClick = async () => {
    const curl = buildCurlCommand(endpoint, method, body);

    console.log("CODEX_COMMAND: copy_curl", {
      endpoint: `${API_BASE}${endpoint}`,
      method,
      body,
    });

    try {
      await navigator.clipboard.writeText(curl);
    } catch (err) {
      console.error("Failed to copy cURL to clipboard", err);
      // Fallback: show in an alert so it can be copied manually
      alert("Copy this cURL command:\n\n" + curl);
    }
  };

  const baseClasses =
    "inline-flex items-center rounded-full border text-[10px] font-medium shadow-sm";
  const sizeClasses =
    size === "xs"
      ? "px-2 py-0.5"
      : "px-3 py-1";
  const colorClasses =
    "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`${baseClasses} ${sizeClasses} ${colorClasses}`}
      title="Copy this request as a cURL command"
    >
      {label ?? "Copy cURL"}
    </button>
  );
}
