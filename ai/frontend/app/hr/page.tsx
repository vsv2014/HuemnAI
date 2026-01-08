"use client";

import { useState, useEffect } from "react";
import { hrService, recordActivity } from "../../services/api";

export default function HRPage() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Track activity
  useEffect(() => {
    const interval = setInterval(() => {
      recordActivity("user1").catch(() => {}); // Silently fail - non-critical
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  async function handleSend(e?: any) {
    if (e) e.preventDefault();
    if (!message.trim()) return;
    
    setLoading(true);
    try {
      const res = await hrService(message);
      setResult(res);
    } catch (error) {
      console.error("Error with HR service:", error);
      setResult({ error: "Error processing request. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">HR Services</h1>
      <p className="text-sm text-white/60 mb-6">
        Post jobs, shortlist candidates, and manage hiring. Supports LinkedIn integration.
      </p>
      
      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="flex-1 rounded-md bg-black/30 px-4 py-2"
          placeholder="Try: 'post job: Software Engineer | We need a Python developer...' or 'shortlist candidates with Python, React, AWS'"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-white px-4 py-2 text-black disabled:opacity-50"
        >
          {loading ? "Processing..." : "Send"}
        </button>
      </form>

      <div className="mt-6">
        {loading && <div className="text-white/60">Processing...</div>}
        
        {result && !result.error && (
          <div className="space-y-4">
            {result.action === "post_job" && result.success && (
              <div className="p-4 rounded-lg bg-green-500/20 border border-green-500/50">
                <h3 className="font-semibold text-green-400 mb-2">✅ Job Posted Successfully</h3>
                <div className="text-sm">
                  <p><strong>Title:</strong> {result.job?.title || "N/A"}</p>
                  <p><strong>Posted to:</strong> {result.posted_to?.filter(Boolean).join(", ") || "N/A"}</p>
                  {result.job?.id && <p><strong>Job ID:</strong> {result.job.id}</p>}
                </div>
              </div>
            )}

            {result.action === "shortlist" && result.candidates && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-blue-500/20 border border-blue-500/50">
                  <h3 className="font-semibold text-blue-400 mb-2">
                    👥 Found {result.count} Candidates
                  </h3>
                </div>
                
                {result.candidates.map((c: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold">{c.name || "Unknown"}</h4>
                      {c.source && (
                        <span className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded">
                          {c.source}
                        </span>
                      )}
                    </div>
                    <div className="text-sm space-y-1">
                      {c.current_title && (
                        <p><strong>Current Title:</strong> {c.current_title}</p>
                      )}
                      {c.skills && c.skills.length > 0 && (
                        <p>
                          <strong>Skills:</strong> {c.skills.join(", ")}
                        </p>
                      )}
                      {c.experience_years !== undefined && (
                        <p><strong>Experience:</strong> {c.experience_years} years</p>
                      )}
                      {c.linkedin_url && (
                        <p>
                          <strong>LinkedIn:</strong>{" "}
                          <a
                            href={c.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            View Profile
                          </a>
                        </p>
                      )}
                      {c.email && (
                        <p className="text-white/60"><strong>Email:</strong> {c.email}</p>
                      )}
                    </div>
                  </div>
                ))}

                {result.notification && (
                  <div className="p-4 rounded-lg bg-yellow-500/20 border border-yellow-500/50">
                    <p className="text-sm">📧 {result.notification.message}</p>
                  </div>
                )}
              </div>
            )}

            {result.message && !result.action && (
              <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                <p>{result.message}</p>
              </div>
            )}
          </div>
        )}

        {result?.error && (
          <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/50">
            <p className="text-red-400">Error: {result.error}</p>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 rounded-lg bg-white/5 border border-white/10">
        <h3 className="font-semibold mb-2">Available Commands:</h3>
        <ul className="text-sm text-white/70 space-y-1 list-disc list-inside">
          <li>Post job: "post job: Job Title | Job Description"</li>
          <li>Shortlist: "shortlist candidates with Python, React, AWS for Senior Developer position"</li>
          <li>Find candidates: "find candidates for Software Engineer with 5 years experience"</li>
        </ul>
      </div>
    </div>
  );
}
