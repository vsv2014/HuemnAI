"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function ImportExportPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const [activeTab, setActiveTab] = useState<"import" | "export">("import");
  const [fileType, setFileType] = useState<"zip" | "json">("zip");
  const [importType, setImportType] = useState<"full" | "incremental">("full");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleImport = useCallback(async () => {
    if (!selectedFile) {
      alert("Please select a file");
      return;
    }
    alert(`Importing ${fileType} file as ${importType} import...`);
  }, [selectedFile, fileType, importType]);

  const handleExport = useCallback(async () => {
    alert("Exporting agent definition...");
  }, []);

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              Import & Export
            </h1>
            <p className="text-white/60 text-lg">
              Import or export the current App definition as a JSON file.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-white/10 mb-6">
            <button
              onClick={() => setActiveTab("import")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "import"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Import
            </button>
            <button
              onClick={() => setActiveTab("export")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "export"
                  ? "text-blue-400 border-b-2 border-blue-400"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Export
            </button>
          </div>

          {activeTab === "import" && (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-lg font-semibold mb-4 text-white">Import Agent Definition</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">File Type</label>
                  <select
                    value={fileType}
                    onChange={(e) => setFileType(e.target.value as "zip" | "json")}
                    className="w-full px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white"
                  >
                    <option value="zip">ZIP</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Import Type</label>
                  <select
                    value={importType}
                    onChange={(e) => setImportType(e.target.value as "full" | "incremental")}
                    className="w-full px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white"
                  >
                    <option value="full">Full Import</option>
                    <option value="incremental">Incremental Import</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Select File</label>
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white"
                    accept={fileType === "zip" ? ".zip" : ".json"}
                  />
                </div>
                <button
                  onClick={handleImport}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Import
                </button>
              </div>
            </div>
          )}

          {activeTab === "export" && (
            <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-lg font-semibold mb-4 text-white">Export Agent Definition</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">File Type</label>
                  <select
                    value={fileType}
                    onChange={(e) => setFileType(e.target.value as "zip" | "json")}
                    className="w-full px-4 py-2 bg-[#0f1419]/60 border border-white/10 rounded-lg text-white"
                  >
                    <option value="zip">ZIP</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <button
                  onClick={handleExport}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Export
                </button>
              </div>
            </div>
          )}
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
