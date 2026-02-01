"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TOOLS_LIST } from "@/config/tools";
import { submitDemoRequest } from "@/services/api";

export default function DemoRequestPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    selectedTools: [] as string[],
    useCase: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleToolToggle = (toolId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedTools: prev.selectedTools.includes(toolId)
        ? prev.selectedTools.filter((id) => id !== toolId)
        : [...prev.selectedTools, toolId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!formData.name || !formData.email || !formData.company) {
        setError("Please fill in all required fields (Name, Email, Company)");
        setLoading(false);
        return;
      }

      if (formData.selectedTools.length === 0) {
        setError("Please select at least one tool you're interested in");
        setLoading(false);
        return;
      }

      const result = await submitDemoRequest({
        name: formData.name,
        email: formData.email,
        company: formData.company,
        phone: formData.phone || undefined,
        selected_tools: formData.selectedTools,
        use_case: formData.useCase,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        // Redirect to thank you page after 3 seconds
        setTimeout(() => {
          router.push("/demo-request/thank-you");
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit demo request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">✅</div>
          <h1 className="text-3xl font-bold text-white mb-4">Request Submitted!</h1>
          <p className="text-white/70 mb-6">
            Thank you for requesting a demo. We'll get in touch with you shortly.
          </p>
          <p className="text-white/50 text-sm">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] py-20 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Link
              href="/"
              className="text-white/60 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/10"
              title="Go to Home"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </Link>
            <span className="text-white/20">|</span>
            <button
              onClick={() => router.back()}
              className="text-white/60 hover:text-white text-sm transition-colors"
            >
              ← Back
            </button>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Request a Demo
          </h1>
          <p className="text-lg text-white/70">
            Tell us about yourself and which tools you'd like to explore
          </p>
        </div>

        {/* Form */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">Your Information</h2>
              
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg bg-black/30 px-4 py-3 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full rounded-lg bg-black/30 px-4 py-3 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Company Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full rounded-lg bg-black/30 px-4 py-3 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-lg bg-black/30 px-4 py-3 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Tool Selection */}
            <div className="space-y-4 pt-6 border-t border-white/10">
              <h2 className="text-xl font-semibold text-white mb-4">
                Which Tools Are You Interested In? <span className="text-red-400">*</span>
              </h2>
              <div className="grid md:grid-cols-2 gap-3">
                {TOOLS_LIST.map((tool) => (
                  <label
                    key={tool.id}
                    className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                      formData.selectedTools.includes(tool.id)
                        ? "bg-blue-500/20 border-blue-500/50"
                        : "bg-black/20 border-white/10 hover:border-white/20"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.selectedTools.includes(tool.id)}
                      onChange={() => handleToolToggle(tool.id)}
                      className="w-5 h-5 rounded border-white/20 bg-black/30 text-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-white/90 font-medium">{tool.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Use Case */}
            <div className="space-y-4 pt-6 border-t border-white/10">
              <h2 className="text-xl font-semibold text-white mb-4">Your Use Case</h2>
              <textarea
                value={formData.useCase}
                onChange={(e) => setFormData({ ...formData, useCase: e.target.value })}
                placeholder="Tell us about your use case, challenges, or what you'd like to achieve..."
                rows={5}
                className="w-full rounded-lg bg-black/30 px-4 py-3 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-white/40 resize-none"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 text-white font-semibold hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Submitting..." : "Submit Demo Request →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

