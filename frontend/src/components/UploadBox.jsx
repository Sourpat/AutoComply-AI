import { useState } from "react";
import { validateLicensePDF } from "../services/api";

export default function UploadBox({ onResult }) {
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);

  function handleDragOver(e) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }

  function handleFile(file) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      onResult({ success: false, error: "Only PDF files are supported." });
      return;
    }
    setSelectedFile(file);
  }

  async function processUpload() {
    if (!selectedFile) return;

    setLoading(true);
    const res = await validateLicensePDF(selectedFile);
    setLoading(false);

    onResult(res);
  }

  return (
    <div className="w-full mt-6">
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
          ${dragging ? "border-blue-500 bg-blue-50" : "border-gray-400"}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById("fileInput").click()}
      >
        <p className="text-gray-700">
          {dragging ? "Drop your PDF..." : "Drag & drop a PDF or click to upload"}
        </p>
      </div>

      <input
        id="fileInput"
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => handleFile(e.target.files[0])}
      />

      {selectedFile && (
        <div className="mt-4 p-4 rounded-lg bg-gray-50 shadow">
          <p className="font-medium">{selectedFile.name}</p>
          <p className="text-sm text-gray-600">
            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </p>

          <button
            onClick={processUpload}
            disabled={loading}
            className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 
                       text-white rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Run Compliance Check"}
          </button>
        </div>
      )}
    </div>
  );
}
