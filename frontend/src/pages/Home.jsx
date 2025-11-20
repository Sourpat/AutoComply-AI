import { useState } from "react";
import UploadBox from "../components/UploadBox";
import ManualEntryForm from "../components/ManualEntryForm";
import ComplianceCard from "../components/ComplianceCard";

export default function Home() {
  const [mode, setMode] = useState("upload");  // "upload" or "manual"
  const [result, setResult] = useState(null);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-gray-900">
        AutoComply AI – License Compliance Checker
      </h1>
      <p className="text-gray-600 mt-2">
        {mode === "upload"
          ? "Upload a practitioner’s DEA or State license PDF to instantly validate compliance."
          : "Use manual entry to input license information and run the compliance check."}
      </p>

      {/* Mode toggle */}
      <div className="mt-4 mb-6 flex space-x-4">
        <button
          onClick={() => { setMode("upload"); setResult(null); }}
          className={`px-4 py-2 rounded-lg ${mode==="upload" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800"}`}
        >
          Upload PDF
        </button>
        <button
          onClick={() => { setMode("manual"); setResult(null); }}
          className={`px-4 py-2 rounded-lg ${mode==="manual" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800"}`}
        >
          Manual Entry
        </button>
      </div>

      {/* Mode-specific content */}
      {mode === "upload" ? (
        <UploadBox onResult={setResult} />
      ) : (
        <ManualEntryForm onResult={setResult} />
      )}

      {result && (
        <div className="mt-6">
          <ComplianceCard data={result} />
        </div>
      )}
    </div>
  );
}
