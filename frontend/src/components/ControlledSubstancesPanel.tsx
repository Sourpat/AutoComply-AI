// src/components/ControlledSubstancesPanel.tsx
import { useEffect, useState } from "react";
import {
  ControlledSubstance,
  ControlledSubstanceHistoryItem,
  searchControlledSubstances,
  fetchControlledSubstancesHistory,
} from "../api/controlledSubstancesClient";

interface ControlledSubstancesPanelProps {
  accountNumber: string;
  value: ControlledSubstance[];
  onChange: (items: ControlledSubstance[]) => void;
}

type Tab = "search" | "history";

export function ControlledSubstancesPanel(
  props: ControlledSubstancesPanelProps
) {
  const { accountNumber, value, onChange } = props;

  const [tab, setTab] = useState<Tab>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ControlledSubstance[]>([]);
  const [historyItems, setHistoryItems] = useState<
    ControlledSubstanceHistoryItem[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load recent history when accountNumber is present and tab = history
  useEffect(() => {
    if (!accountNumber || tab !== "history") return;

    const loadHistory = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const items = await fetchControlledSubstancesHistory(accountNumber);
        setHistoryItems(items);
      } catch (err: any) {
        console.error("Failed to load controlled substances history", err);
        setError(
          err?.message ??
            "Failed to load recent items for this account. See console."
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, [accountNumber, tab]);

  const addItem = (item: ControlledSubstance) => {
    // Avoid duplicates by id
    if (value.some((x) => x.id === item.id)) return;
    onChange([...value, item]);
  };

  const removeItem = (id: string) => {
    onChange(value.filter((x) => x.id !== id));
  };

  const performSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const results = await searchControlledSubstances(searchQuery.trim());
      setSearchResults(results);
    } catch (err: any) {
      console.error("Failed to search controlled substances", err);
      setError(
        err?.message ??
          "Failed to search controlled substances. See console for details."
      );
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMeta = (
    item: ControlledSubstanceHistoryItem | ControlledSubstance
  ) => {
    const parts: string[] = [];

    if (item.strength && item.unit) {
      parts.push(`${item.strength} ${item.unit}`);
    } else if (item.strength) {
      parts.push(item.strength);
    } else if (item.dosage_form) {
      parts.push(item.dosage_form);
    }

    const schedule = item.schedule || item.dea_schedule;
    if (schedule) {
      parts.push(`Schedule ${schedule}`);
    }

    if (item.dea_code) {
      parts.push(`DEA: ${item.dea_code}`);
    }

    if ("ndc" in item && item.ndc) {
      parts.push(`NDC: ${item.ndc}`);
    }

    if ("last_ordered_at" in item && item.last_ordered_at) {
      parts.push(`Last ordered: ${item.last_ordered_at}`);
    }

    return (
      <span className="text-[10px] text-gray-500">{parts.join(" · ")}</span>
    );
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3 text-[11px] shadow-sm">
      <header className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-700">
            Controlled Substances
          </h2>
          <p className="text-[10px] text-gray-500">
            Search controlled substances and attach them to this CSF. Recent
            items are scoped by account number.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="mb-2 flex rounded-md bg-gray-100 p-0.5 text-[10px]">
        <button
          type="button"
          onClick={() => setTab("search")}
          className={`flex-1 rounded-md px-2 py-1 ${
            tab === "search"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`flex-1 rounded-md px-2 py-1 ${
            tab === "history"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          Recent for account
        </button>
      </div>

      {/* Search tab */}
      {tab === "search" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Try: Hydrocodone, NDC 00093-3102-01, DEA Schedule II"
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-[11px] text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 ring-indigo-500"
            />
            <button
              type="button"
              onClick={performSearch}
              disabled={isLoading || !searchQuery.trim()}
              className="rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Searching…" : "Search"}
            </button>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700">
              {error}
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-1">
              {searchResults.map((drug) => (
                <div
                  key={drug.id}
                  className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-gray-100"
                >
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-gray-900">
                      {drug.name}
                    </span>
                    {renderMeta(drug)}
                  </div>
                  <button
                    type="button"
                    className="rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
                    onClick={() => addItem(drug)}
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}

          {searchResults.length === 0 && !isLoading && !error && (
            <p className="text-[10px] text-gray-400">
              No results yet. Try a search above.
            </p>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        <div className="space-y-2">
          {!accountNumber && (
            <p className="text-[10px] text-gray-400">
              Enter an account number in the form to load recent controlled
              substances for that account.
            </p>
          )}
          {accountNumber && isLoading && (
            <p className="text-[10px] text-gray-400">Loading history…</p>
          )}
          {accountNumber && !isLoading && error && (
            <div className="rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700">
              {error}
            </div>
          )}
          {accountNumber &&
            !isLoading &&
            !error &&
            historyItems.length === 0 && (
              <p className="text-[10px] text-gray-400">
                No recent controlled substance items found for this account.
              </p>
            )}
          {historyItems.length > 0 && (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-1">
              {historyItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-gray-100"
                >
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-gray-900">
                      {item.name}
                    </span>
                    {renderMeta(item)}
                  </div>
                  <button
                    type="button"
                    className="rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
                    onClick={() => addItem(item)}
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected items */}
      <div className="mt-3 border-t border-gray-200 pt-2">
        <h3 className="text-[11px] font-semibold text-gray-700">
          Attached to this CSF
        </h3>
        {value.length === 0 ? (
          <p className="text-[10px] text-gray-400">
            No controlled substances attached yet.
          </p>
        ) : (
          <ul className="mt-1 space-y-1 text-[11px] text-gray-800">
            {value.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-md bg-gray-50 px-2 py-1"
              >
                <span>
                  <span className="font-medium">{item.name}</span>
                  {item.strength && ` – ${item.strength}`}
                  {item.unit && ` ${item.unit}`}
                  {item.schedule || item.dea_schedule
                    ? ` · Schedule ${item.schedule ?? item.dea_schedule}`
                    : ""}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-[10px] font-medium text-gray-500 hover:text-red-600"
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
