"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    // Password validation (client-side pre-check)
    if (password.length < 1) {
       setError("Password is required");
       return;
    }

    setLoading(true);

    try {
      const response = await login(email, password);
      
      if (response.error) {
        setError(response.error || "Login failed");
        setLoading(false);
        return;
      }

      // Set auth state with subscribed tools and login time (SSO)
      setAuth(
        response.token,
        response.user,
        response.subscription_status,
        response.trial_days_remaining,
        response.subscribed_tools || [],
        response.login_time || null
      );

      // Redirect to home
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-transparent">
      {/* Background elements moved to global layout */}
      
      <div className="w-full max-w-md relative z-10 p-6">
        {/* Floating shapes decoration */}
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full blur-xl opacity-60 animate-bounce" style={{ animationDuration: '3s' }}></div>
        <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full blur-xl opacity-60 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}></div>

        <div className="bg-white/5 backdrop-blur-2xl rounded-3xl px-8 pb-8 pt-0 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] relative overflow-hidden group">
          
          {/* Shine effect on card hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

          <div className="text-center mb-8 relative">
            <div className="-mb-12 -mt-10">
              <img 
                src="/images/logo-head.png" 
                alt="HUEMN Logo" 
                className="w-48 h-48 object-contain mx-auto drop-shadow-xl"
              />
            </div>
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-white mb-2 drop-shadow-sm">Welcome Back</h1>
            <p className="text-blue-200/60 font-medium">Sign in to your intelligent workspace</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm shadow-[0_0_20px_rgba(239,68,68,0.1)] backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <span className="text-lg">⚠️</span>
                <div>
                  {error}
                  {error.includes("Invalid email or password") && (
                    <div className="mt-2 text-xs text-red-300/80 bg-red-500/10 p-2 rounded-lg">
                      <p>💡 Server restart detected?</p>
                      <p className="mt-1">Please <Link href="/auth/signup" className="underline hover:text-white transition-colors">sign up again</Link> to create a new account.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="group/input">
              <label htmlFor="email" className="block text-sm font-medium text-blue-200/80 mb-2 ml-1 group-focus-within/input:text-blue-400 transition-colors">
                Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-5 py-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-black/40 transition-all shadow-inner"
                  placeholder="name@company.com"
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 group-hover/input:opacity-100 pointer-events-none transition-opacity -z-10 blur-sm"></div>
              </div>
            </div>

            <div className="group/input">
              <label htmlFor="password" className="block text-sm font-medium text-blue-200/80 mb-2 ml-1 group-focus-within/input:text-purple-400 transition-colors">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-5 py-4 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 focus:bg-black/40 transition-all shadow-inner"
                  placeholder="••••••••"
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 opacity-0 group-hover/input:opacity-100 pointer-events-none transition-opacity -z-10 blur-sm"></div>
              </div>
              <div className="flex justify-end pt-1">
                <Link href="/auth/forgot-password" className="text-xs text-blue-300 hover:text-white transition-colors">
                  Forgot Password?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] transform hover:-translate-y-0.5 active:translate-y-0 text-lg relative overflow-hidden group/btn"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 skew-y-12"></div>
              <span className="relative z-10">{loading ? "Signing in..." : "Sign In"}</span>
            </button>
          </form>

          <div className="mt-8 text-center pt-6 border-t border-white/5">
            <p className="text-white/40 text-sm">
              New to Huemn AI?{" "}
              <Link href="/auth/signup" className="text-blue-400 hover:text-blue-300 font-semibold hover:underline decoration-2 underline-offset-4 transition-all">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

