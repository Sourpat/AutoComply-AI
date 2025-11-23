// src/components/ControlledSubstancesSearchSection.tsx
import { useEffect, useState } from "react";
import { ControlledSubstanceItem } from "../domain/controlledSubstances";
import { searchControlledSubstances } from "../api/controlledSubstancesClient";

interface Props {
  selectedItems: ControlledSubstanceItem[];
  onSelectedItemsChange: (items: ControlledSubstanceItem[]) => void;
  title?: string;
  compact?: boolean;
}

export function ControlledSubstancesSearchSection({
  selectedItems,
  onSelectedItemsChange,
  title = "Controlled Substances for this request",
  compact = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ControlledSubstanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simple debounce for "auto-search as you type"
  useEffect(() => {
    let cancelled = false;
    if (query.trim() === "") {
      setResults([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const handle = setTimeout(() => {
      searchControlledSubstances(query)
        .then((data) => {
          if (cancelled) return;
          setResults(data);
        })
        .catch((err: any) => {
          if (cancelled) return;
          setError(err?.message ?? "Failed to search controlled substances");
        })
        .finally(() => {
          if (cancelled) return;
          setIsLoading(false);
        });
    }, 300); // 300ms debounce

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  const addItem = (item: ControlledSubstanceItem) => {
    if (selectedItems.some((i) => i.id === item.id)) return;
    onSelectedItemsChange([...selectedItems, item]);
  };

  const removeItem = (id: string) => {
    onSelectedItemsChange(selectedItems.filter((i) => i.id !== id));
  };

  return (
    <section
      className={`mt-4 rounded-lg border border-gray-200 bg-white p-3 ${
        compact ? "text-[11px]" : "text-sm"
      }`}
    >
      <header className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            {title}
          </h3>
          <p className="text-[11px] text-gray-500">
            Search and attach controlled substance items to this form. In a real
            integration this would call the product catalog in real time.
          </p>
        </div>
      </header>

      <div className="mb-3 flex items-center gap-2">
        <input
          type="text"
          placeholder="Search by name or NDC..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
        />
        {isLoading && (
          <span className="whitespace-nowrap text-[11px] text-gray-500">
            Searching…
          </span>
        )}
      </div>

      {error && (
        <div className="mb-2 rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700">
          {error}
        </div>
      )}

      {/* Search results */}
      {query.trim() !== "" && (
        <div className="mb-3">
          <div className="mb-1 text-[11px] font-medium text-gray-700">
            Search results
          </div>
          {results.length === 0 && !isLoading && (
            <div className="text-[11px] text-gray-500">
              No matching controlled substances found.
            </div>
          )}
          {results.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded-md border border-gray-100 bg-gray-50">
              {results.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between px-2 py-1"
                >
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-gray-900">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {item.ndc ? `NDC: ${item.ndc}` : "NDC: —"} ·{" "}
                      {item.strength || "Strength: —"} ·{" "}
                      {item.dosage_form || "Form: —"} ·{" "}
                      {item.dea_schedule
                        ? `DEA schedule ${item.dea_schedule}`
                        : "DEA schedule: —"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => addItem(item)}
                    className="ml-2 rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Selected items (this form's "item history") */}
      <div>
        <div className="mb-1 text-[11px] font-medium text-gray-700">
          Items attached to this form
        </div>
        {selectedItems.length === 0 ? (
          <div className="text-[11px] text-gray-500">
            No controlled substances attached yet.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-md border border-gray-100 bg-white">
            {selectedItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between px-2 py-1"
              >
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-gray-900">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {item.ndc ? `NDC: ${item.ndc}` : "NDC: —"} ·{" "}
                    {item.strength || "Strength: —"} ·{" "}
                    {item.dea_schedule
                      ? `DEA schedule ${item.dea_schedule}`
                      : "DEA schedule: —"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="ml-2 text-[10px] text-red-600 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
