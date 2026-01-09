/**
 * AdminResetPanel - Admin-only panel for resetting all data
 * 
 * ⚠️ DANGEROUS OPERATION ⚠️
 * Only visible to admin users.
 * Requires typing "RESET" to enable the reset button.
 */

import React, { useState, useEffect } from 'react';
import { getResetPreview, resetAllData, type ResetPreview } from '../../api/adminApi';

interface AdminResetPanelProps {
  onResetComplete?: () => void;
}

export const AdminResetPanel: React.FC<AdminResetPanelProps> = ({ onResetComplete }) => {
  const [preview, setPreview] = useState<ResetPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadPreview();
  }, []);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getResetPreview();
      setPreview(data);
    } catch (err) {
      console.error('Failed to load reset preview:', err);
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (confirmText !== 'RESET') {
      return;
    }

    if (!confirm('⚠️ This will DELETE ALL DATA permanently. Are you absolutely sure?')) {
      return;
    }

    setResetting(true);
    setError(null);
    setSuccess(false);

    try {
      await resetAllData();
      setSuccess(true);
      setConfirmText('');
      
      // Reload preview to show empty state
      await loadPreview();
      
      // Notify parent
      if (onResetComplete) {
        onResetComplete();
      }
    } catch (err) {
      console.error('Failed to reset data:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset data');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-slate-500">Loading preview...</p>
      </div>
    );
  }

  if (error && !preview) {
    return (
      <div className="p-6 border border-red-200 rounded-lg bg-red-50">
        <p className="text-sm text-red-800">❌ {error}</p>
        <button
          onClick={loadPreview}
          className="mt-2 px-3 py-1 text-sm rounded bg-red-600 text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const totalRows = preview ? Object.values(preview.tables).reduce((sum, count) => sum + count, 0) : 0;
  const totalFiles = preview?.files.exports_dir || 0;

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="p-4 border-2 border-red-500 rounded-lg bg-red-50">
        <h3 className="text-lg font-bold text-red-900 mb-2">
          ⚠️ DANGER ZONE ⚠️
        </h3>
        <p className="text-sm text-red-800">
          This operation will permanently delete ALL data from the database and file system.
          This action CANNOT be undone.
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="p-4 border border-green-500 rounded-lg bg-green-50">
          <p className="text-sm font-semibold text-green-900">
            ✅ Reset completed successfully!
          </p>
          <p className="text-xs text-green-700 mt-1">
            All data has been deleted. You can now reload the Console to see the empty state.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 border border-red-500 rounded-lg bg-red-50">
          <p className="text-sm font-semibold text-red-900">❌ Error</p>
          <p className="text-xs text-red-700 mt-1">{error}</p>
        </div>
      )}

      {/* Preview Counts */}
      <div className="border border-slate-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">
          What will be deleted:
        </h4>
        
        <div className="space-y-2 text-sm">
          {/* Database Tables */}
          <div className="grid grid-cols-2 gap-2">
            {preview && Object.entries(preview.tables).map(([table, count]) => (
              <div key={table} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded">
                <span className="text-slate-700 font-mono text-xs">{table}</span>
                <span className="text-slate-900 font-semibold">{count} rows</span>
              </div>
            ))}
          </div>

          {/* Files */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded">
            <span className="text-slate-700 font-mono text-xs">Export files</span>
            <span className="text-slate-900 font-semibold">{totalFiles} files</span>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between px-3 py-2 bg-red-50 rounded border border-red-200">
            <span className="text-red-900 font-semibold">TOTAL</span>
            <span className="text-red-900 font-bold">{totalRows} rows + {totalFiles} files</span>
          </div>
        </div>
      </div>

      {/* Confirmation Input */}
      <div className="border border-slate-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-slate-900 mb-2">
          Type <code className="px-1 py-0.5 bg-slate-100 rounded font-mono text-red-600">RESET</code> to confirm:
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="Type RESET here..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          disabled={resetting}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleReset}
          disabled={confirmText !== 'RESET' || resetting}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {resetting ? '⏳ Resetting...' : '🗑️ RESET ALL DATA'}
        </button>

        <button
          onClick={loadPreview}
          disabled={resetting}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          🔄 Refresh Preview
        </button>
      </div>

      {/* Instructions */}
      <div className="text-xs text-slate-600 space-y-1">
        <p>• This panel is only visible to admin users</p>
        <p>• Use this for development/testing only</p>
        <p>• Backend must be running at port 8001</p>
        <p>• After reset, refresh the Console to see empty state</p>
      </div>
    </div>
  );
};
