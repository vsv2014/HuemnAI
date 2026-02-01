"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle } from "lucide-react";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Redirect to dashboard after 5 seconds
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[#151a2a] rounded-xl p-8 border border-gray-800 text-center">
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 bg-green-500/10 rounded-full flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-2">
          {isMock ? "Mock Payment Successful" : "Payment Successful!"}
        </h1>
        <p className="text-gray-400 mb-8">
          {isMock 
            ? "This was a simulated payment because Stripe is not configured." 
            : "Thank you for your subscription. Your account has been upgraded successfully."}
        </p>

        <div className="space-y-4">
          <Link 
            href="/"
            className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Go to Dashboard
          </Link>
          
          <p className="text-sm text-gray-500">
            Redirecting in {countdown} seconds...
          </p>
        </div>
      </div>
    </div>
  );
}
