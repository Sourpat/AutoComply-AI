/**
 * Analytics Dashboard Page
 * 
 * Comprehensive analytics and metrics dashboard for workflow console.
 * Provides insights into case metrics, SLA performance, audit activity, and evidence patterns.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  getConsoleAnalyticsSummary,
  type ConsoleAnalyticsSummaryResponse,
} from '../api/analyticsApi';
import { ApiErrorPanel } from '../components/ApiErrorPanel';
import { toApiErrorDetails, type ApiErrorDetails } from '../lib/api';

// ============================================================================
// Types
// ============================================================================

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

interface FilterState {
  days: number;
  decisionType: string;
  assignedTo: string;
}

interface Preset {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: string;
}

const PRESET_STORAGE_KEY = 'acai.analytics.presets.v1';

// ============================================================================
// Decision Type Helpers
// ============================================================================

/**
 * Get human-readable label for decision type.
 * Maps decision type keys to display labels.
 */
function getDecisionTypeLabel(decisionType: string): string {
  const labels: Record<string, string> = {
    'csf_practitioner': 'CSF - Practitioner',
    'csf_facility': 'CSF - Facility',
    'csf_ems': 'CSF - EMS',
    'csf_researcher': 'CSF - Researcher',
    'ohio_tddd': 'Ohio TDDD License',
    'ny_pharmacy_license': 'NY Pharmacy License',
  };
  return labels[decisionType] || decisionType;
}

const DAYS_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

// ============================================================================
// Component
// ============================================================================

export function AnalyticsDashboardPage() {
  const [filters, setFilters] = useState<FilterState>({
    days: 30,
    decisionType: '',
    assignedTo: '',
  });

  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  const [summary, setSummary] = useState<ConsoleAnalyticsSummaryResponse | null>(null);
  const [summaryState, setSummaryState] = useState<LoadingState>('idle');
  const [errorDetails, setErrorDetails] = useState<ApiErrorDetails | null>(null);

  const availableDecisionTypes = useMemo(() => {
    const types = summary?.decision_type_breakdown ?? [];
    return [''].concat(types.map(item => item.name));
  }, [summary]);

  useEffect(() => {
    const stored = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Preset[];
      setPresets(Array.isArray(parsed) ? parsed : []);
    } catch {
      setPresets([]);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [filters.days]);
  
  const loadSummary = async () => {
    setSummaryState('loading');
    setErrorDetails(null);
    try {
      const data = await getConsoleAnalyticsSummary(filters.days);
      setSummary(data);
      setSummaryState('success');
    } catch (err) {
      setErrorDetails(toApiErrorDetails(err, { url: '/api/console/analytics/summary' }));
      setSummaryState('error');
    }
  };

  const savePresets = (next: Preset[]) => {
    setPresets(next);
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(next));
  };

  const handleSavePreset = () => {
    const name = prompt('Name this filter preset:');
    if (!name) return;
    const preset: Preset = {
      id: `preset-${Date.now()}`,
      name: name.trim(),
      filters,
      createdAt: new Date().toISOString(),
    };
    savePresets([preset, ...presets]);
    setSelectedPresetId(preset.id);
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(presetId);
    setFilters(preset.filters);
  };

  const handleDeletePreset = (presetId: string) => {
    const next = presets.filter((p) => p.id !== presetId);
    savePresets(next);
    if (selectedPresetId === presetId) {
      setSelectedPresetId('');
    }
  };
  
  const buildConsoleLink = (queryParams: Record<string, string>) => {
    const params = new URLSearchParams(queryParams);
    return `/console?${params.toString()}`;
  };
  
  return (
    <React.Fragment>
      <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-slate-900 bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/console" className="text-sm text-slate-400 hover:text-slate-200">
              ← Back to Console
            </Link>
            <h1 className="text-xl font-semibold text-slate-100">Analytics Dashboard</h1>
          </div>
          <button
            onClick={loadSummary}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Saved Views</h2>
              <p className="text-xs text-slate-400">Saved filter presets stay on this device.</p>
            </div>
            <button
              onClick={handleSavePreset}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Save Filter Preset
            </button>
          </div>
          {presets.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">No presets yet. Save your current filters to reuse them later.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] ${
                    selectedPresetId === preset.id
                      ? "border-indigo-400/70 bg-indigo-500/20 text-indigo-100"
                      : "border-slate-700 bg-slate-900 text-slate-300"
                  }`}
                >
                  <button onClick={() => handleApplyPreset(preset.id)}>{preset.name}</button>
                  <button
                    onClick={() => handleDeletePreset(preset.id)}
                    className="text-slate-500 hover:text-slate-200"
                    aria-label={`Delete ${preset.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-slate-300">Time period</label>
              <select
                value={filters.days}
                onChange={(e) => setFilters(prev => ({ ...prev, days: Number(e.target.value) }))}
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100"
              >
                {DAYS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300">Decision type</label>
              <select
                value={filters.decisionType}
                onChange={(e) => setFilters(prev => ({ ...prev, decisionType: e.target.value }))}
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100"
              >
                {availableDecisionTypes.map((item) => (
                  <option key={item} value={item}>{item ? getDecisionTypeLabel(item) : 'All Types'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300">Assigned to</label>
              <input
                type="text"
                value={filters.assignedTo}
                onChange={(e) => setFilters(prev => ({ ...prev, assignedTo: e.target.value }))}
                placeholder="Filter by reviewer"
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100"
              />
              <p className="mt-1 text-[11px] text-slate-500">Presets will remember these filters.</p>
            </div>
          </div>
        </div>

        {errorDetails && (
          <ApiErrorPanel error={errorDetails} title="Analytics summary failed" onRetry={loadSummary} />
        )}

        <div className="grid gap-4 md:grid-cols-5">
          <KPICard title="Total Cases" value={summary?.total_cases ?? 0} loading={summaryState === 'loading'} linkTo={buildConsoleLink({})} />
          <KPICard title="Open" value={summary?.open_cases ?? 0} loading={summaryState === 'loading'} tone="blue" linkTo={buildConsoleLink({ status: 'new,in_review,needs_info' })} />
          <KPICard title="Closed" value={summary?.closed_cases ?? 0} loading={summaryState === 'loading'} tone="green" linkTo={buildConsoleLink({ status: 'approved,blocked,closed' })} />
          <KPICard title="Overdue" value={summary?.overdue_cases ?? 0} loading={summaryState === 'loading'} tone="red" linkTo={buildConsoleLink({ overdue: 'true' })} />
          <KPICard title="Due in 24h" value={summary?.due_24h ?? 0} loading={summaryState === 'loading'} tone="amber" linkTo={buildConsoleLink({ dueSoon: 'true' })} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <BreakdownCard title="Status Breakdown" items={summary?.status_breakdown ?? []} emptyLabel="No status data yet" />
          <BreakdownCard title="Decision Type Breakdown" items={summary?.decision_type_breakdown ?? []} emptyLabel="No decision type data yet" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TimeSeriesCard title="Cases Created" data={summary?.cases_created_daily ?? []} emptyLabel="No case creation data" />
          <TimeSeriesCard title="Cases Closed" data={summary?.cases_closed_daily ?? []} emptyLabel="No case closure data" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <BreakdownCard title="Top Event Types" items={summary?.top_event_types ?? []} emptyLabel="Coming soon: event taxonomy" />
          <BreakdownCard title="Verifier Activity" items={summary?.verifier_activity ?? []} emptyLabel="No verifier activity yet" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <BreakdownCard title="Top Evidence Tags" items={summary?.top_evidence_tags ?? []} emptyLabel="Coming soon: evidence taxonomy" />
          <BreakdownCard title="Request Info Reasons" items={summary?.request_info_reasons ?? []} emptyLabel="Coming soon: request info reasons" />
        </div>
      </div>
    </div>
    </React.Fragment>
  );
}

interface KPICardProps {
  title: string;
  value: number;
  loading?: boolean;
  tone?: 'blue' | 'green' | 'red' | 'amber';
  linkTo?: string;
}

function KPICard({ title, value, loading, tone, linkTo }: KPICardProps) {
  const toneClasses: Record<string, string> = {
    blue: 'bg-blue-500/15 text-blue-200 border-blue-500/30',
    green: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
    red: 'bg-red-500/15 text-red-200 border-red-500/30',
    amber: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  };

  const content = (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/70 p-4 ${tone ? toneClasses[tone] : ''}`}>
      <p className="text-xs font-semibold text-slate-300">{title}</p>
      {loading ? (
        <div className="mt-2 h-6 w-12 rounded bg-slate-700/60" />
      ) : (
        <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
      )}
    </div>
  );

  return linkTo ? <Link to={linkTo}>{content}</Link> : content;
}

interface BreakdownCardProps {
  title: string;
  items: Array<{ name: string; count: number }>;
  emptyLabel: string;
}

function BreakdownCard({ title, items, emptyLabel }: BreakdownCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">{emptyLabel}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map(item => (
            <div key={item.name} className="flex items-center justify-between text-xs">
              <span className="text-slate-300">{item.name}</span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-100">{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface TimeSeriesCardProps {
  title: string;
  data: Array<{ date: string; count: number }>;
  emptyLabel: string;
}

function TimeSeriesCard({ title, data, emptyLabel }: TimeSeriesCardProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <p className="mt-3 text-xs text-slate-500">{emptyLabel}</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      <div className="mt-3 space-y-2">
        {data.map(point => (
          <div key={point.date} className="flex items-center gap-3 text-xs">
            <span className="w-20 font-mono text-slate-500">{point.date}</span>
            <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-indigo-500/70"
                style={{ width: `${(point.count / maxCount) * 100}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-100">
                {point.count}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
