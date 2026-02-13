"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login, googleLogin } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { useGoogleLogin } from '@react-oauth/google';
import OtpVerificationModal from "@/components/OtpVerificationModal";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // OTP State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [pendingGoogleToken, setPendingGoogleToken] = useState<string | null>(null);
  const [pendingPassword, setPendingPassword] = useState<string | null>(null);

  const handleLoginSuccess = (data: any) => {
    if (data.requires_otp) {
        setOtpEmail(data.user?.email || email);
        if (!pendingGoogleToken) {
            setPendingPassword(password);
        }
        setShowOtpModal(true);
        setLoading(false);
        return;
    }

    if (data.token && data.user) {
      setAuth(
        data.token,
        data.user,
        data.subscription_status,
        data.trial_days_remaining,
        data.subscribed_tools,
        data.login_time || null
      );
      router.push("/");
    } else {
      setError("Invalid response from server");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPendingGoogleToken(null);
    setPendingPassword(null);
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    // Password validation
    if (password.length < 1) {
       setError("Password is required");
       return;
    }

    setLoading(true);

    try {
      const data = await login(email, password);
      
      if (data.error) {
        setError(data.error || "Login failed");
      } else {
        handleLoginSuccess(data);
      }
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      if (!showOtpModal) setLoading(false);
    }
  };

  const googleLoginAction = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
        handleGoogleAuth(tokenResponse.access_token);
    },
    onError: () => setError('Google Login Failed'),
  });

  const handleGoogleAuth = async (token: string) => {
    setLoading(true);
    setError("");
    setPendingGoogleToken(token);
    try {
        const data = await googleLogin(token);
        if (data.error) {
            setError(data.error);
        } else {
            handleLoginSuccess(data);
        }
    } catch (err) {
        setError("Google Login failed");
    } finally {
        if (!showOtpModal) setLoading(false);
    }
  };

  const handleVerifyOtp = async (otpCode: string) => {
    setLoading(true);
    try {
        let data;
        if (pendingGoogleToken) {
            data = await googleLogin(pendingGoogleToken, otpCode);
        } else {
            data = await login(email, pendingPassword || password, otpCode);
        }

        if (data.error) {
            setError(data.error);
        } else {
            handleLoginSuccess(data);
            setShowOtpModal(false);
        }
    } catch (err) {
        setError("Verification failed");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-transparent">
      {/* Background elements moved to global layout */}
      <OtpVerificationModal
        email={otpEmail}
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        onVerify={handleVerifyOtp}
        isLoading={loading}
        error={error}
      />
      
      <div className="w-full max-w-md relative z-10 p-6">
        {/* Floating shapes decoration */}
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full blur-xl opacity-60 animate-bounce" style={{ animationDuration: '3s' }}></div>
        <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full blur-xl opacity-60 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}></div>

        <div className="bg-white/5 backdrop-blur-2xl rounded-3xl px-8 pb-8 pt-0 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] relative overflow-hidden group">
          
          {/* Shine effect on card hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

          <div className="text-center mb-8 relative">
            <Link href="/" className="block -mb-12 -mt-10 group/logo">
              <img 
                src="/images/logo-head.png" 
                alt="HUEMN Logo" 
                className="w-48 h-48 object-contain mx-auto drop-shadow-xl group-hover/logo:scale-110 transition-transform duration-300"
              />
            </Link>
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

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#0f0f13] text-white/40">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => googleLoginAction()}
            disabled={loading}
            className="w-full py-3.5 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-3 group/google"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span className="group-hover/google:underline decoration-2 underline-offset-4">Sign in with Google</span>
          </button>

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

