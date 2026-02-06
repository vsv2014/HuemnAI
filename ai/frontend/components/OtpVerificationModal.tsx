"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface OtpVerificationModalProps {
  email: string;
  isOpen: boolean;
  onClose: () => void;
  onVerify: (otp: string) => Promise<void>;
  isLoading: boolean;
  error?: string;
}

export default function OtpVerificationModal({
  email,
  isOpen,
  onClose,
  onVerify,
  isLoading,
  error
}: OtpVerificationModalProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  
  // Handle OTP input change
  const handleChange = (element: HTMLInputElement, index: number) => {
    if (isNaN(Number(element.value))) return false;

    setOtp([...otp.map((d, idx) => (idx === index ? element.value : d))]);

    // Focus next input
    if (element.nextSibling && element.value !== "") {
      (element.nextSibling as HTMLInputElement).focus();
    }
  };

  // Handle backspace
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (otp[index] === "" && index > 0) {
        setOtp([...otp.map((d, idx) => (idx === index - 1 ? "" : d))]);
        const prevInput = (e.currentTarget.previousSibling as HTMLInputElement);
        if (prevInput) prevInput.focus();
      } else {
        setOtp([...otp.map((d, idx) => (idx === index ? "" : d))]);
      }
    } else if (e.key === "Enter") {
        handleSubmit();
    }
  };

  const handleSubmit = () => {
    const otpValue = otp.join("");
    if (otpValue.length === 6) {
      onVerify(otpValue);
    }
  };

  // Auto-submit when all fields are filled
  useEffect(() => {
    if (otp.every(val => val !== "")) {
      // Optional: Auto submit or just focus submit button
    }
  }, [otp]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#0f0f13] border border-white/10 rounded-2xl shadow-2xl p-8 overflow-hidden transform transition-all scale-100 opacity-100">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-blue-500/20 rounded-full blur-[50px] pointer-events-none" />

        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <div className="relative z-10 text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>

          <h3 className="text-2xl font-bold text-white mb-2">Verify it's you</h3>
          <p className="text-white/60 mb-8">
            We've sent a verification code to <br />
            <span className="text-white font-medium">{email}</span>
          </p>

          <div className="flex justify-center gap-2 mb-8">
            {otp.map((data, index) => (
              <input
                key={index}
                type="text"
                name="otp"
                maxLength={1}
                value={data}
                onChange={(e) => handleChange(e.target, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onFocus={(e) => e.target.select()}
                className="w-12 h-14 bg-white/5 border border-white/10 rounded-lg text-center text-xl font-bold text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              />
            ))}
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isLoading || otp.some(val => val === "")}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
          >
            {isLoading ? "Verifying..." : "Verify Code"}
          </button>

          <p className="mt-6 text-sm text-white/40">
            Didn't receive the code?{" "}
            <button className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Resend
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
