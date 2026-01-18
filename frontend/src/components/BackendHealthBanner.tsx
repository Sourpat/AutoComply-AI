// frontend/src/components/BackendHealthBanner.tsx
import { useEffect, useState } from "react";
import { API_BASE, apiFetch } from "../lib/api";

interface BackendHealthBannerProps {
  className?: string;
}

export function BackendHealthBanner({ className = "" }: BackendHealthBannerProps) {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkHealth() {
      try {
        // Try to hit /workflow/health endpoint
        await apiFetch("/workflow/health", { timeout: 3000 });
        if (mounted) {
          setIsHealthy(true);
          setIsChecking(false);
        }
      } catch (error) {
        if (mounted) {
          setIsHealthy(false);
          setIsChecking(false);
        }
      }
    }

    checkHealth();
    
    // Recheck every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (isChecking) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-600 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-gray-400 animate-pulse"></div>
          <span>Checking backend connection...</span>
          <span className="text-xs text-gray-500">API: {API_BASE}</span>
        </div>
      </div>
    );
  }

  if (isHealthy) {
    return (
      <div className={`rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 ${className}`}>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span>Backend connected</span>
          <span className="text-xs text-green-600">API: {API_BASE}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-red-500"></div>
        <span className="font-medium">Backend unreachable</span>
        <span className="text-xs text-red-600">API: {API_BASE}</span>
      </div>
      <p className="mt-1 text-xs text-red-600">
        {API_BASE.includes("127.0.0.1") || API_BASE.includes("localhost") 
          ? "⚠️ Localhost backend not accessible from deployed frontend. Deploy backend to a public host."
          : "Backend may be offline or URL is incorrect. Check deployment configuration."}
      </p>
    </div>
  );
}
