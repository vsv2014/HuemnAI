"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import AgentLayout from "@/components/AgentLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function PublishPage() {
  const params = useParams();
  const agentId = parseInt(params?.id as string);
  const [lastPublished, setLastPublished] = useState("12/03/2025");
  const [selectedComponents, setSelectedComponents] = useState({
    flows: { selected: true, count: 1, total: 1 },
    automationTasks: {
      selected: true,
      dialogTasks: { selected: true, count: 14, total: 14 },
      digitalForms: { selected: true, count: 1, total: 1 },
      faqs: { selected: true, count: 1, total: 1 },
      smallTalk: { selected: true, count: 1, total: 1 },
    },
  });

  const toggleComponent = useCallback((path: string[]) => {
    setSelectedComponents((prev) => {
      const newState = { ...prev };
      let current: any = newState;
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]].selected = !current[path[path.length - 1]].selected;
      return newState;
    });
  }, []);

  const handlePublish = useCallback(async () => {
    // Implement publish logic
    alert("Publishing agent...");
  }, []);

  return (
    <ErrorBoundary>
      <AgentLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent mb-3">
              Publish
            </h1>
            <p className="text-white/60 mb-2">Last Published On : {lastPublished}</p>
            <p className="text-white/60 text-lg">
              Publish the App to make the latest version of the edits are available for end users
            </p>
          </div>

          {/* Flows */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-4 shadow-2xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedComponents.flows.selected}
                onChange={() => toggleComponent(["flows"])}
                className="w-5 h-5 text-blue-600 rounded"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-white">Flows</h3>
                <p className="text-sm text-white/60">
                  Choose the flows to be included in this deployment
                </p>
              </div>
            </label>
            {selectedComponents.flows.selected && (
              <div className="ml-8 mt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={true}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-white/80">Start Flows</span>
                  <span className="text-sm text-green-400 ml-2">
                    {selectedComponents.flows.count} of {selectedComponents.flows.total}
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Automation Tasks */}
          <div className="bg-[#1a1f3a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-4 shadow-2xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedComponents.automationTasks.selected}
                onChange={() => toggleComponent(["automationTasks"])}
                className="w-5 h-5 text-blue-600 rounded"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-white">Automation Tasks</h3>
                <p className="text-sm text-white/60">
                  Choose the tasks to be included in this deployment
                </p>
              </div>
            </label>
            {selectedComponents.automationTasks.selected && (
              <div className="ml-8 mt-3 space-y-2">
                {Object.entries(selectedComponents.automationTasks)
                  .filter(([key]) => key !== "selected")
                  .map(([key, value]: [string, any]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={value.selected}
                        onChange={() => toggleComponent(["automationTasks", key])}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm capitalize text-white/80">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                      <span className="text-sm text-green-400 ml-2">
                        {value.count} of {value.total}
                      </span>
                    </label>
                  ))}
              </div>
            )}
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={handlePublish}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Proceed
            </button>
          </div>
        </div>
      </AgentLayout>
    </ErrorBoundary>
  );
}
