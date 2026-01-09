import React from "react";
import { Copy } from "lucide-react";

type CopyCurlButtonProps = {
  getCommand: () => string;
  label?: string;
};

export function CopyCurlButton({
  getCommand,
  label = "Copy as cURL",
}: CopyCurlButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleClick() {
    setError(null);
    try {
      const command = getCommand();
      if (!command) {
        throw new Error("Nothing to copy");
      }
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(command);
      } else {
        // Fallback: create a temporary textarea
        const textarea = document.createElement("textarea");
        textarea.value = command;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        if (textarea.parentNode === document.body) {
          document.body.removeChild(textarea);
        }
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e: any) {
      setError(e?.message ?? "Failed to copy");
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-slate-900 px-2.5 py-1 text-[10px] font-medium text-slate-100 hover:border-cyan-400 hover:bg-slate-800"
      >
        <Copy className="h-3 w-3" />
        <span>{copied ? "Copied!" : label}</span>
      </button>
      {error && (
        <span className="text-[9px] text-rose-300">
          Couldn&apos;t copy: {error}
        </span>
      )}
    </div>
  );
}
