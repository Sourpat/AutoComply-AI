import React, { useState, useEffect } from 'react';
import { API_BASE } from '../lib/api';
import { useRagDebug } from '../devsupport/RagDebugContext';

interface HealthResponse {
  status: string;
  service: string;
  version: string;
  checks: Record<string, string>;
}

/**
 * DevSupport Diagnostics Banner
 * 
 * Shows critical deployment information for troubleshooting:
 * - Resolved API base URL
 * - Build commit hash (VITE_GIT_SHA)
 * - Backend health status
 * 
 * Only visible when RAG Debug mode is enabled (toggled via DevSupport button in header).
 */
export function DiagnosticsBanner() {
  const { enabled } = useRagDebug();
  
  // Don't render if debug mode is disabled
  if (!enabled) {
    return null;
  }
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const gitSha = (import.meta.env.VITE_GIT_SHA || 'unknown').substring(0, 7);
  const buildEnv = import.meta.env.VITE_APP_ENV || 'dev';

  useEffect(() => {
    // Fetch backend health on mount
    const fetchHealth = async () => {
      try {
        const response = await fetch(`${API_BASE}/health`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data: HealthResponse = await response.json();
        setHealth(data);
        setHealthError(null);
      } catch (err) {
        setHealthError(err instanceof Error ? err.message : 'Unknown error');
        setHealth(null);
      }
    };

    fetchHealth();
  }, []);

  if (isCollapsed) {
    return (
      <div
        className="fixed bottom-4 right-4 bg-purple-900/90 backdrop-blur-sm border border-purple-500/30 rounded-lg px-3 py-2 cursor-pointer hover:bg-purple-800/90 transition-colors z-50"
        onClick={() => setIsCollapsed(false)}
      >
        <div className="text-xs text-purple-200 font-mono">
          🔧 DevSupport Diagnostics
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-purple-900/95 backdrop-blur-sm border border-purple-500/40 rounded-lg shadow-xl max-w-md z-50">
      <div className="flex items-center justify-between px-4 py-2 border-b border-purple-500/30">
        <div className="flex items-center gap-2">
          <span className="text-purple-200">🔧</span>
          <span className="text-sm font-semibold text-purple-100">DevSupport Diagnostics</span>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="text-purple-300 hover:text-purple-100 transition-colors"
          aria-label="Collapse"
        >
          ✕
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* API Base URL */}
        <div>
          <div className="text-xs text-purple-300 mb-1">API Base URL</div>
          <div className="text-sm font-mono text-purple-50 bg-purple-950/50 px-2 py-1 rounded border border-purple-500/20">
            {API_BASE}
          </div>
        </div>

        {/* Build Info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-purple-300 mb-1">Git SHA</div>
            <div className="text-sm font-mono text-purple-50 bg-purple-950/50 px-2 py-1 rounded border border-purple-500/20">
              {gitSha}
            </div>
          </div>
          <div>
            <div className="text-xs text-purple-300 mb-1">Environment</div>
            <div className="text-sm font-mono text-purple-50 bg-purple-950/50 px-2 py-1 rounded border border-purple-500/20">
              {buildEnv}
            </div>
          </div>
        </div>

        {/* Backend Health */}
        <div>
          <div className="text-xs text-purple-300 mb-1">Backend Health</div>
          {healthError ? (
            <div className="text-sm text-red-300 bg-red-950/50 px-2 py-1 rounded border border-red-500/30">
              ❌ {healthError}
            </div>
          ) : health ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm bg-purple-950/50 px-2 py-1 rounded border border-purple-500/20">
                <span className="text-green-400">✓</span>
                <span className="text-purple-50 font-mono">
                  {health.status.toUpperCase()}
                </span>
                <span className="text-purple-300">•</span>
                <span className="text-purple-200 text-xs">v{health.version}</span>
              </div>
              {health.checks && Object.keys(health.checks).length > 0 && (
                <div className="text-xs text-purple-300 bg-purple-950/30 px-2 py-1 rounded">
                  Checks: {Object.entries(health.checks).map(([k, v]) => `${k}=${v}`).join(', ')}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-purple-300 bg-purple-950/50 px-2 py-1 rounded border border-purple-500/20">
              Loading...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
