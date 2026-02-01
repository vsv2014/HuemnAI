"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/services/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await forgotPassword(email);
      if (response.error) {
        setStatus("error");
        setMessage(response.error);
      } else {
        setStatus("success");
        setMessage(response.message || "If your email is registered, you will receive a password reset link.");
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-transparent">
      <div className="w-full max-w-md relative z-10 p-6">
        {/* Floating shapes decoration */}
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full blur-xl opacity-60 animate-bounce" style={{ animationDuration: '3s' }}></div>
        <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full blur-xl opacity-60 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}></div>

        <div className="bg-white/5 backdrop-blur-2xl rounded-3xl px-8 pb-8 pt-0 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] relative overflow-hidden group">
          
          <div className="text-center mb-8 relative">
            <div className="-mb-12 -mt-4">
              <img 
                src="/images/logo-head.png" 
                alt="HUEMN Logo" 
                className="w-48 h-48 object-contain mx-auto drop-shadow-xl"
              />
            </div>
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-white mb-2 drop-shadow-sm">Forgot Password</h1>
            <p className="text-blue-200/60 font-medium">Enter your email to reset your password</p>
          </div>

          {message && (
            <div className={`mb-6 p-4 rounded-xl text-sm shadow-[0_0_20px_rgba(0,0,0,0.1)] backdrop-blur-sm ${
              status === "error" 
                ? "bg-red-500/10 border border-red-500/30 text-red-300" 
                : "bg-green-500/10 border border-green-500/30 text-green-300"
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-lg">{status === "error" ? "⚠️" : "✅"}</span>
                <div>{message}</div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-blue-100 ml-1">Email Address</label>
              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-blue-300/50 group-focus-within/input:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-blue-200/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all hover:bg-white/10"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {status === "loading" ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link href="/auth/login" className="text-sm text-blue-300 hover:text-white transition-colors">
              Remember your password? <span className="underline decoration-blue-500/50 underline-offset-4">Sign in</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
