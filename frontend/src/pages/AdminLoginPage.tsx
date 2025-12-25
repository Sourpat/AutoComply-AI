// frontend/src/pages/AdminLoginPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const adminPasscode = import.meta.env.VITE_ADMIN_PASSCODE || "admin123";
    
    if (passcode === adminPasscode) {
      localStorage.setItem("admin_unlocked", "true");
      // Trigger storage event manually for same-window detection
      window.dispatchEvent(new Event("storage"));
      navigate("/admin/review");
    } else {
      setError("Invalid passcode");
      setPasscode("");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2">Admin Access</h1>
        <p className="text-gray-400 mb-6">
          Enter the admin passcode to access the Review Queue
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Passcode
            </label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="Enter passcode"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-400">{error}</p>
            )}
          </div>
          
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors"
          >
            Unlock Admin Access
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate("/")}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            ← Back to Home
          </button>
        </div>
        
        <div className="mt-6 p-3 bg-gray-900 border border-gray-700 rounded text-xs text-gray-500">
          <p className="font-semibold mb-1">Demo Note:</p>
          <p>Default passcode: <code className="text-gray-400">admin123</code></p>
          <p className="mt-1">Set VITE_ADMIN_PASSCODE in .env to customize</p>
        </div>
      </div>
    </div>
  );
}
