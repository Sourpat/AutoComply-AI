// src/components/BackendConnectionIndicator.tsx
import React, { useEffect, useState } from "react";
import { API_BASE } from "../lib/api";

export function BackendConnectionIndicator() {
  const [status, setStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${API_BASE}/health`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          setStatus("connected");
        } else {
          setStatus("disconnected");
        }
      } catch (error) {
        setStatus("disconnected");
      } finally {
        setLastCheck(new Date());
      }
    };

    // Check immediately
    checkBackend();

    // Then check every 30 seconds
    const interval = setInterval(checkBackend, 30000);

    return () => clearInterval(interval);
  }, []);

  if (status === "checking") {
    return (
      <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 border border-gray-200 z-50">
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
        <div className="text-xs">
          <div className="font-medium text-gray-700">Checking backend...</div>
          <div className="text-gray-500 text-[10px]">{API_BASE}</div>
        </div>
      </div>
    );
  }

  if (status === "disconnected") {
    return (
      <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg px-4 py-2 border-l-4 border-red-500 z-50">
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full mt-1"></div>
          <div className="text-xs">
            <div className="font-semibold text-red-700 mb-0.5">
              Backend Not Reachable
            </div>
            <div className="text-gray-600 text-[10px] mb-1">{API_BASE}</div>
            <div className="text-gray-500 text-[10px]">
              Last check: {lastCheck.toLocaleTimeString()}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="text-[10px] text-gray-600 space-y-0.5">
                <div>1. Check backend is running on port 8001</div>
                <div>2. Run: <code className="bg-gray-100 px-1">uvicorn src.api.main:app --host 127.0.0.1 --port 8001</code></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Connected - show minimal indicator
  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-md px-3 py-1.5 flex items-center gap-2 border border-green-200 z-50 opacity-75 hover:opacity-100 transition-opacity">
      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
      <div className="text-[10px] text-gray-600">
        Backend: <span className="font-medium text-green-700">Online</span>
      </div>
    </div>
  );
}
