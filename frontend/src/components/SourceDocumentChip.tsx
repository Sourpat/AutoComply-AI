import { emitCodexCommand } from "../utils/codexLogger";

// src/components/SourceDocumentChip.tsx
interface SourceDocumentChipProps {
  id?: string;
  label?: string;
  url?: string;
}

export function SourceDocumentChip({ id, label, url }: SourceDocumentChipProps) {
  const resolvedLabel = label ?? id ?? "View source document";
  const resolvedUrl = url ?? "#";

  return (
    <a
      href={resolvedUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
      onClick={() => {
        emitCodexCommand("open_regulatory_source_document", {
          label: resolvedLabel ?? "Source document",
          url: resolvedUrl,
        });
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      <span>{resolvedLabel}</span>
    </a>
  );
}
