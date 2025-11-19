import { useState } from "react";
import UploadBox from "../components/UploadBox";
import ComplianceCard from "../components/ComplianceCard";

export default function Home() {
  const [result, setResult] = useState(null);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* PAGE HEADER */}
      <h1 className="text-3xl font-bold text-gray-900">
        AutoComply AI – License Compliance Checker
      </h1>

      <p className="text-gray-600 mt-2">
        Upload a practitioner’s DEA or State license PDF or use manual entry
        (coming soon) to instantly validate compliance and see required forms.
      </p>

      {/* UPLOAD BOX */}
      <UploadBox onResult={setResult} />

      {/* COMPLIANCE CARD */}
      {result && (
        <div className="mt-6">
          <ComplianceCard data={result} />
        </div>
      )}
    </div>
  );
}
