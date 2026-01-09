/**
 * Analytics Dashboard Page
 * 
 * Comprehensive analytics and metrics dashboard for workflow console.
 * Provides insights into case metrics, SLA performance, audit activity, and evidence patterns.
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getAnalyticsOverview,
  getAnalyticsSla,
  getAnalyticsAudit,
  getAnalyticsEvidence,
  type AnalyticsResponse,
  type SLAMetrics,
  type AuditMetrics,
  type EvidenceMetrics,
} from '../api/analyticsApi';
import {
  listViews,
  createView,
  updateView,
  deleteView,
  type SavedView,
} from '../api/savedViewsApi';

// ============================================================================
// Types
// ============================================================================

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

interface FilterState {
  days: number;
  decisionType: string;
  assignedTo: string;
}

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
  const navigate = useNavigate();
  
  // Filters
  const [filters, setFilters] = useState<FilterState>({
    days: 30,
    decisionType: '',
    assignedTo: '',
  });
  
  // Saved Views
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string>('');
  const [viewsLoading, setViewsLoading] = useState(false);
  
  // Dynamic decision types (populated from analytics data)
  const [availableDecisionTypes, setAvailableDecisionTypes] = useState<Array<{value: string, label: string}>>([]);
  
  // Data state
  const [overview, setOverview] = useState<AnalyticsResponse | null>(null);
  const [sla, setSla] = useState<SLAMetrics | null>(null);
  const [audit, setAudit] = useState<AuditMetrics | null>(null);
  const [evidence, setEvidence] = useState<EvidenceMetrics | null>(null);
  
  // Loading states
  const [overviewState, setOverviewState] = useState<LoadingState>('idle');
  const [slaState, setSlaState] = useState<LoadingState>('idle');
  const [auditState, setAuditState] = useState<LoadingState>('idle');
  const [evidenceState, setEvidenceState] = useState<LoadingState>('idle');
  
  // Error messages
  const [error, setError] = useState<string | null>(null);
  
  // Load saved views on mount
  useEffect(() => {
    loadSavedViews();
  }, []);
  
  // Fetch data on mount and filter changes
  useEffect(() => {
    loadAllData();
  }, [filters.days, filters.decisionType, filters.assignedTo]);
    const loadSavedViews = async () => {
    setViewsLoading(true);
    try {
      const views = await listViews('analytics');
      setSavedViews(views);
    } catch (err) {
      console.error('Failed to load saved views:', err);
    } finally {
      setViewsLoading(false);
    }
  };
  
  const handleApplyView = (viewId: string) => {
    const view = savedViews.find(v => v.id === viewId);
    if (!view) return;
    
    setSelectedViewId(viewId);
    
    // Apply view_json to filters
    const viewData = view.view_json;
    setFilters({
      days: viewData.days ?? 30,
      decisionType: viewData.decisionType ?? '',
      assignedTo: viewData.assignedTo ?? '',
    });
  };
  
  const handleSaveView = async () => {
    const name = prompt('Enter a name for this view:');
    if (!name) return;
    
    try {
      await createView({
        name,
        scope: 'analytics',
        view_json: {
          days: filters.days,
          decisionType: filters.decisionType,
          assignedTo: filters.assignedTo,
        },
      });
      await loadSavedViews();
      alert('View saved successfully!');
    } catch (err) {
      console.error('Failed to save view:', err);
      alert('Failed to save view');
    }
  };
  
  const handleUpdateView = async () => {
    if (!selectedViewId) return;
    
    const view = savedViews.find(v => v.id === selectedViewId);
    if (!view) return;
    
    const name = prompt('Update view name:', view.name);
    if (!name) return;
    
    try {
      await updateView(selectedViewId, {
        name,
        view_json: {
          days: filters.days,
          decisionType: filters.decisionType,
          assignedTo: filters.assignedTo,
        },
      });
      await loadSavedViews();
      alert('View updated successfully!');
    } catch (err) {
      console.error('Failed to update view:', err);
      alert('Failed to update view');
    }
  };
  
  const handleDeleteView = async () => {
    if (!selectedViewId) return;
    
    const view = savedViews.find(v => v.id === selectedViewId);
    if (!view) return;
    
    if (!confirm(`Delete view "${view.name}"?`)) return;
    
    try {
      await deleteView(selectedViewId);
      setSelectedViewId('');
      await loadSavedViews();
      alert('View deleted successfully!');
    } catch (err) {
      console.error('Failed to delete view:', err);
      alert('Failed to delete view');
    }
  };
    const loadAllData = async () => {
    setError(null);
    
    // Load overview
    setOverviewState('loading');
    try {
      const data = await getAnalyticsOverview({
        days: filters.days,
        decisionType: filters.decisionType || undefined,
        assignedTo: filters.assignedTo || undefined,
      });
      setOverview(data);      
      // Extract unique decision types from breakdown and populate dropdown
      if (data.decisionTypeBreakdown && data.decisionTypeBreakdown.length > 0) {
        const types = [{ value: '', label: 'All Types' }].concat(
          data.decisionTypeBreakdown.map(item => ({
            value: item.decisionType,
            label: getDecisionTypeLabel(item.decisionType)
          }))
        );
        setAvailableDecisionTypes(types);
      } else {
        // Fallback to empty state if no data yet
        setAvailableDecisionTypes([{ value: '', label: 'All Types' }]);
      }
            setOverviewState('success');
    } catch (err) {
      console.error('Failed to load analytics overview:', err);
      setOverviewState('error');
      setError('Failed to load analytics data');
    }
    
    // Load SLA
    setSlaState('loading');
    try {
      const data = await getAnalyticsSla();
      setSla(data);
      setSlaState('success');
    } catch (err) {
      console.error('Failed to load SLA metrics:', err);
      setSlaState('error');
    }
    
    // Load Audit
    setAuditState('loading');
    try {
      const data = await getAnalyticsAudit({ days: filters.days });
      setAudit(data);
      setAuditState('success');
    } catch (err) {
      console.error('Failed to load audit metrics:', err);
      setAuditState('error');
    }
    
    // Load Evidence
    setEvidenceState('loading');
    try {
      const data = await getAnalyticsEvidence();
      setEvidence(data);
      setEvidenceState('success');
    } catch (err) {
      console.error('Failed to load evidence metrics:', err);
      setEvidenceState('error');
    }
  };
  
  const buildConsoleLink = (queryParams: Record<string, string>) => {
    const params = new URLSearchParams(queryParams);
    return `/console?${params.toString()}`;
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                to="/console" 
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                ← Back to Console
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
            </div>
            <button
              onClick={loadAllData}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Refresh Data
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Saved Views Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Saved Views
              </label>
              <select
                value={selectedViewId}
                onChange={(e) => handleApplyView(e.target.value)}
                disabled={viewsLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">-- Select a saved view --</option>
                {savedViews.map(view => (
                  <option key={view.id} value={view.id}>
                    {view.name} {view.is_shared ? '(Shared)' : ''}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex gap-2 pt-6">
              <button
                onClick={handleSaveView}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
              >
                Save View
              </button>
              
              {selectedViewId && (
                <>
                  <button
                    onClick={handleUpdateView}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                  >
                    Update
                  </button>
                  <button
                    onClick={handleDeleteView}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Period
              </label>
              <select
                value={filters.days}
                onChange={(e) => setFilters(prev => ({ ...prev, days: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DAYS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Decision Type
              </label>
              <select
                value={filters.decisionType}
                onChange={(e) => setFilters(prev => ({ ...prev, decisionType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableDecisionTypes.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned To
              </label>
              <input
                type="text"
                value={filters.assignedTo}
                onChange={(e) => setFilters(prev => ({ ...prev, assignedTo: e.target.value }))}
                placeholder="Leave blank for all"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md mb-6">
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <KPICard
            title="Total Cases"
            value={overview?.summary.totalCases ?? 0}
            loading={overviewState === 'loading'}
            linkTo={buildConsoleLink({})}
          />
          <KPICard
            title="Open"
            value={overview?.summary.openCount ?? 0}
            loading={overviewState === 'loading'}
            color="blue"
            linkTo={buildConsoleLink({ status: 'new,in_review,needs_info' })}
          />
          <KPICard
            title="Closed"
            value={overview?.summary.closedCount ?? 0}
            loading={overviewState === 'loading'}
            color="green"
            linkTo={buildConsoleLink({ status: 'approved,blocked,closed' })}
          />
          <KPICard
            title="Overdue"
            value={overview?.summary.overdueCount ?? 0}
            loading={overviewState === 'loading'}
            color="red"
            linkTo={buildConsoleLink({ overdue: 'true' })}
          />
          <KPICard
            title="Due in 24h"
            value={overview?.summary.dueSoonCount ?? 0}
            loading={overviewState === 'loading'}
            color="yellow"
            linkTo={buildConsoleLink({ dueSoon: 'true' })}
          />
        </div>
        
        {/* SLA Metrics */}
        {sla && slaState === 'success' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">SLA Performance</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetricRow label="Avg Age (Open Cases)" value={`${sla.avgAgeOpen.toFixed(1)}h`} />
              <MetricRow label="Avg Time to Close" value={`${sla.avgTimeToClose.toFixed(1)}h`} />
            </div>
          </div>
        )}
        
        {/* Breakdowns Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Status Breakdown */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Status Breakdown</h2>
              <Link
                to="/console"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View Cases →
              </Link>
            </div>
            
            {overviewState === 'loading' && <LoadingSpinner />}
            {overviewState === 'success' && overview && (
              <div className="space-y-2">
                {overview.statusBreakdown.length === 0 && (
                  <p className="text-sm text-gray-500">No data available</p>
                )}
                {overview.statusBreakdown.map(item => (
                  <BreakdownRow
                    key={item.status}
                    label={item.status}
                    count={item.count}
                    linkTo={buildConsoleLink({ status: item.status })}
                  />
                ))}
              </div>
            )}
          </div>
          
          {/* Decision Type Breakdown */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Decision Type Breakdown</h2>
              <Link
                to="/console"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View Cases →
              </Link>
            </div>
            
            {overviewState === 'loading' && <LoadingSpinner />}
            {overviewState === 'success' && overview && (
              <div className="space-y-2">
                {overview.decisionTypeBreakdown.length === 0 && (
                  <p className="text-sm text-gray-500">No data available</p>
                )}
                {overview.decisionTypeBreakdown.map(item => (
                  <BreakdownRow
                    key={item.decisionType}
                    label={item.decisionType}
                    count={item.count}
                    linkTo={buildConsoleLink({ decisionType: item.decisionType })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Time Series */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Cases Created */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cases Created (Last 14 Days)</h2>
            
            {overviewState === 'loading' && <LoadingSpinner />}
            {overviewState === 'success' && overview && (
              <TimeSeriesTable data={overview.casesCreatedTimeSeries} />
            )}
          </div>
          
          {/* Cases Closed */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cases Closed (Last 14 Days)</h2>
            
            {overviewState === 'loading' && <LoadingSpinner />}
            {overviewState === 'success' && overview && (
              <TimeSeriesTable data={overview.casesClosedTimeSeries} />
            )}
          </div>
        </div>
        
        {/* Audit Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Top Event Types */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Event Types</h2>
            
            {auditState === 'loading' && <LoadingSpinner />}
            {auditState === 'success' && audit && (
              <div className="space-y-2">
                {audit.topEventTypes.length === 0 && (
                  <p className="text-sm text-gray-500">No audit events</p>
                )}
                {audit.topEventTypes.map(item => (
                  <BreakdownRow
                    key={item.eventType}
                    label={item.eventType}
                    count={item.count}
                  />
                ))}
              </div>
            )}
          </div>
          
          {/* Verifier Activity */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Verifier Activity</h2>
            
            {auditState === 'loading' && <LoadingSpinner />}
            {auditState === 'success' && audit && (
              <div className="space-y-2">
                {audit.verifierActivity.length === 0 && (
                  <p className="text-sm text-gray-500">No verifier activity</p>
                )}
                {audit.verifierActivity.map(item => (
                  <BreakdownRow
                    key={item.actor}
                    label={item.actor}
                    count={item.count}
                    linkTo={buildConsoleLink({ assignedTo: item.actor })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Evidence Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Evidence Tags */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Evidence Tags</h2>
            
            {evidenceState === 'loading' && <LoadingSpinner />}
            {evidenceState === 'success' && evidence && (
              <div className="space-y-2">
                {evidence.evidenceTags.length === 0 && (
                  <p className="text-sm text-gray-500">No evidence tags</p>
                )}
                {evidence.evidenceTags.slice(0, 10).map(item => (
                  <BreakdownRow
                    key={item.tag}
                    label={item.tag}
                    count={item.count}
                  />
                ))}
              </div>
            )}
          </div>
          
          {/* Request Info Reasons */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Request Info Reasons</h2>
            
            {overviewState === 'loading' && <LoadingSpinner />}
            {overviewState === 'success' && overview && (
              <div className="space-y-2">
                {overview.requestInfoReasons.length === 0 && (
                  <p className="text-sm text-gray-500">No requests for info</p>
                )}
                {overview.requestInfoReasons.map(item => (
                  <BreakdownRow
                    key={item.reason}
                    label={item.reason}
                    count={item.count}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Packet Inclusion Stats */}
        {evidence && evidenceState === 'success' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Evidence Packet Inclusion</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricRow label="Total Evidence" value={evidence.totalEvidence.toString()} />
              <MetricRow label="Packeted Evidence" value={evidence.packetedEvidence.toString()} />
              <MetricRow label="Inclusion Rate" value={`${evidence.packetInclusionRate.toFixed(1)}%`} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface KPICardProps {
  title: string;
  value: number;
  loading?: boolean;
  color?: 'blue' | 'green' | 'red' | 'yellow';
  linkTo?: string;
}

function KPICard({ title, value, loading, color, linkTo }: KPICardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-900',
    green: 'bg-green-50 text-green-900',
    red: 'bg-red-50 text-red-900',
    yellow: 'bg-yellow-50 text-yellow-900',
  };
  
  const bgClass = color ? colorClasses[color] : 'bg-gray-50 text-gray-900';
  
  const content = (
    <div className={`rounded-lg border border-gray-200 p-4 ${bgClass}`}>
      <p className="text-sm font-medium opacity-75 mb-1">{title}</p>
      {loading ? (
        <div className="h-8 flex items-center">
          <div className="w-12 h-6 bg-gray-300 animate-pulse rounded"></div>
        </div>
      ) : (
        <p className="text-3xl font-bold">{value}</p>
      )}
    </div>
  );
  
  if (linkTo) {
    return <Link to={linkTo}>{content}</Link>;
  }
  
  return content;
}

interface MetricRowProps {
  label: string;
  value: string;
}

function MetricRow({ label, value }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

interface BreakdownRowProps {
  label: string;
  count: number;
  linkTo?: string;
}

function BreakdownRow({ label, count, linkTo }: BreakdownRowProps) {
  const content = (
    <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-gray-50">
      <span className="text-sm text-gray-700">{label}</span>
      <span className="text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded">
        {count}
      </span>
    </div>
  );
  
  if (linkTo) {
    return <Link to={linkTo}>{content}</Link>;
  }
  
  return content;
}

interface TimeSeriesTableProps {
  data: Array<{ date: string; count: number }>;
}

function TimeSeriesTable({ data }: TimeSeriesTableProps) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-500">No data available</p>;
  }
  
  const maxCount = Math.max(...data.map(d => d.count), 1);
  
  return (
    <div className="space-y-2">
      {data.map(point => (
        <div key={point.date} className="flex items-center space-x-3">
          <span className="text-xs text-gray-600 font-mono w-20">{point.date}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all"
              style={{ width: `${(point.count / maxCount) * 100}%` }}
            ></div>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700">
              {point.count}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
    </div>
  );
}
