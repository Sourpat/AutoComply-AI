// frontend/src/components/BackendHealthBanner.tsx
/**
 * BackendHealthBanner - Connection status notification
 * 
 * Behavior:
 * - SUCCESS: Shows "Backend connected" only ONCE per browser session (via sessionStorage)
 *   OR when transitioning from disconnected -> connected state
 * - SUCCESS: Auto-dismisses after 3500ms
 * - SUCCESS: User can manually close with "x" button
 * - ERROR: Shows "Backend unreachable" persistently until connection restored
 * - ERROR: User can manually close with "x" button
 * 
 * Regression Guard:
 * - sessionStorage key "autocomply_backend_connected_shown" prevents repeated success toasts
 * - Navigation between routes does NOT re-show the success message
 * - Only shows success on health state transition (null->true or false->true)
 * - Timer cleanup on unmount prevents memory leaks
 */
import { useEffect, useState } from "react";
import { API_BASE, apiFetch } from "../lib/api";

interface BackendHealthBannerProps {
  className?: string;
}

// SessionStorage key to track if success message was shown
const SUCCESS_SHOWN_KEY = "autocomply_backend_connected_shown";

export function BackendHealthBanner({ className = "" }: BackendHealthBannerProps) {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [previousHealth, setPreviousHealth] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    let successTimer: number | null = null;

    async function checkHealth() {
      try {
        // Try to hit /workflow/health endpoint
        await apiFetch("/workflow/health", { timeout: 3000 });
        if (mounted) {
          const wasHealthy = isHealthy;
          setIsHealthy(true);
          setIsChecking(false);
          
          // Only show success banner on transition from disconnected -> connected
          // OR on first successful check if not shown this session
          if (wasHealthy === false || (wasHealthy === null && !sessionStorage.getItem(SUCCESS_SHOWN_KEY))) {
            setShowSuccess(true);
            sessionStorage.setItem(SUCCESS_SHOWN_KEY, "true");
            
            // Auto-dismiss success message after 3500ms
            successTimer = window.setTimeout(() => {
              if (mounted) {
                setShowSuccess(false);
              }
            }, 3500);
          }
          
          // Hide error banner when connection is restored
          setShowError(false);
          setPreviousHealth(true);
        }
      } catch (error) {
        if (mounted) {
          const wasHealthy = isHealthy;
          setIsHealthy(false);
          setIsChecking(false);
          
          // Show error banner (persistent until resolved)
          setShowError(true);
          
          // Hide success banner if showing
          setShowSuccess(false);
          
          setPreviousHealth(false);
        }
      }
    }

    checkHealth();
    
    // Recheck every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
      if (successTimer) {
        clearTimeout(successTimer);
      }
    };
  }, [isHealthy]); // Depend on isHealthy to track transitions

  // Don't render anything during initial check (avoid flash)
  if (isChecking && previousHealth === null) {
    return null;
  }

  // Success banner (auto-dismissible, shows only once per session or on reconnect)
  if (showSuccess && isHealthy) {
    return (
      <div className={`rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span>Backend connected</span>
          <span className="text-xs text-green-600">API: {API_BASE}</span>
          <button
            onClick={() => setShowSuccess(false)}
            className="ml-auto text-green-700 hover:text-green-900 transition-colors"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  // Error banner (persistent until connection restored)
  if (showError && !isHealthy) {
    return (
      <div className={`rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 ${className}`}>
        <div className="flex items-center gap-2 mb-1">
          <div className="h-2 w-2 rounded-full bg-red-500"></div>
          <span className="font-medium">Backend unreachable</span>
          <span className="text-xs text-red-600">API: {API_BASE}</span>
          <button
            onClick={() => setShowError(false)}
            className="ml-auto text-red-700 hover:text-red-900 transition-colors"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-red-600">
          {API_BASE.includes("127.0.0.1") || API_BASE.includes("localhost") 
            ? "⚠️ Localhost backend not accessible from deployed frontend. Deploy backend to a public host."
            : "Backend may be offline or URL is incorrect. Check deployment configuration."}
        </p>
      </div>
    );
  }

  // No banner when dismissed or healthy but already shown
  return null;
}
