"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSubscriptionPlans, subscribe } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

interface Plan {
  id: number;
  name: string;
  display_name: string;
  price_monthly: number | null;
  price_yearly: number | null;
  original_price_monthly: number | null;
  original_price_yearly: number | null;
  discount: number;
  features: string[];
  integrations: string[];
  is_popular?: boolean;
  is_enterprise?: boolean;
}

export default function PricingPage() {
  const router = useRouter();
  const { token, isAuthenticated, subscriptionStatus, trialDaysRemaining } = useAuthStore();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    loadPlans();
  }, [isAuthenticated, router]);

  const loadPlans = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getSubscriptionPlans();
      if (response && response.error) {
        setError(response.error);
      } else if (response && response.plans) {
        setPlans(response.plans);
      } else {
        setError("Failed to load pricing plans. Please check if the backend is running.");
      }
    } catch (err: any) {
      console.error("Error loading plans:", err);
      setError("Failed to load pricing plans. Please ensure the backend is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: number, billingPeriod: "monthly" | "yearly") => {
    if (!token) {
      router.push("/auth/login");
      return;
    }

    setSubscribing(planId);
    setError("");

    try {
      const response = await subscribe(planId, billingPeriod, token);
      
      if (response.error) {
        setError(response.error || "Subscription failed");
        setSubscribing(null);
        return;
      }

      // Success - redirect to dashboard
      alert(response.message || "Subscription successful!");
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Subscription failed");
      setSubscribing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0f19]">
        <div className="text-white text-xl">Loading plans...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] py-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-white/60 mb-6">
            Start with a 14-day free trial. 50% off your first subscription!
          </p>
          <p className="text-sm text-white/40 mb-4">
            💡 <strong>Note:</strong> Subscription checks are currently disabled for development/testing.
          </p>
          
          {subscriptionStatus === "trial" && trialDaysRemaining !== null && (
            <div className="inline-block px-6 py-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-blue-300 font-semibold">
                🎉 Free Trial Active: {trialDaysRemaining} days remaining
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="max-w-3xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white/5 backdrop-blur-xl rounded-2xl p-8 border ${
                plan.name === "enterprise"
                  ? "border-purple-500/50 ring-2 ring-purple-500/20 scale-105"
                  : plan.name === "professional"
                  ? "border-blue-500/50 ring-2 ring-blue-500/20"
                  : "border-white/10"
              }`}
            >
              {(plan.is_enterprise || plan.name === "enterprise") && (
                <div className="text-center mb-4">
                  <span className="inline-block px-4 py-1 bg-purple-500/20 text-purple-300 text-sm font-semibold rounded-full">
                    🏢 FOR COMPANIES
                  </span>
                </div>
              )}
              {plan.is_popular && (
                <div className="text-center mb-4">
                  <span className="inline-block px-4 py-1 bg-blue-500/20 text-blue-300 text-sm font-semibold rounded-full">
                    ⭐ MOST POPULAR
                  </span>
                </div>
              )}

              <h3 className="text-2xl font-bold text-white mb-2">
                {(plan.is_enterprise || plan.name === "enterprise") ? "🏢 Enterprise Plan" : plan.display_name}
              </h3>
              {(plan.is_enterprise || plan.name === "enterprise") && (
                <p className="text-sm text-purple-300 mb-4">
                  Perfect for companies and organizations
                </p>
              )}
              
              <div className="mb-6">
                {(plan.is_enterprise || plan.name === "enterprise" || plan.price_monthly === null || plan.price_monthly === undefined || plan.price_monthly === 0) ? (
                  <div>
                    <div className="text-3xl font-bold text-white mb-2">
                      Contact for Quotation
                    </div>
                    <p className="text-sm text-white/60">
                      To access all the tools, please contact us for quotation. Custom pricing based on your needs and requirements.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-white">
                        ${plan.price_monthly?.toFixed(2) || "0.00"}
                      </span>
                      <span className="text-white/60">/month</span>
                    </div>
                    {plan.discount > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm text-white/40 line-through">
                          ${plan.original_price_monthly?.toFixed(2) || "0.00"}
                        </span>
                        <span className="text-sm text-green-400 font-semibold">
                          {plan.discount}% OFF
                        </span>
                      </div>
                    )}
                    <p className="text-sm text-white/50 mt-1">
                      ${plan.price_yearly?.toFixed(2) || "0.00"}/year
                      {plan.price_yearly && plan.original_price_yearly && (
                        <> (save ${((plan.original_price_yearly - plan.price_yearly)).toFixed(2)})</>
                      )}
                    </p>
                  </>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span className="text-white/70 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mb-6">
                <p className="text-sm text-white/60 mb-2">Includes:</p>
                <div className="flex flex-wrap gap-2">
                  {plan.integrations.map((int, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white/70"
                    >
                      {int}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {(plan.is_enterprise || plan.name === "enterprise" || plan.price_monthly === null || plan.price_monthly === undefined || plan.price_monthly === 0) ? (
                  <button
                    onClick={() => router.push("/demo-request")}
                    className="w-full py-3 rounded-lg font-semibold transition-all bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:from-purple-600 hover:to-pink-700"
                  >
                    Contact Us for Quotation
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleSubscribe(plan.id, "monthly")}
                      disabled={subscribing === plan.id}
                      className={`w-full py-3 rounded-lg font-semibold transition-all ${
                        plan.is_popular
                          ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
                          : "bg-white/10 text-white hover:bg-white/20"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {subscribing === plan.id
                        ? "Processing..."
                        : `Subscribe Monthly - $${plan.price_monthly?.toFixed(2) || "0.00"}/mo`}
                    </button>
                    <button
                      onClick={() => handleSubscribe(plan.id, "yearly")}
                      disabled={subscribing === plan.id}
                      className="w-full py-2 text-sm text-white/60 hover:text-white border border-white/10 rounded-lg hover:border-white/20 transition-all disabled:opacity-50"
                    >
                      {subscribing === plan.id
                        ? "Processing..."
                        : `Subscribe Yearly - Save ${plan.discount}%`}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mt-20">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="bg-white/5 rounded-lg p-6 border border-white/10">
              <h3 className="text-white font-semibold mb-2">What's included in the free trial?</h3>
              <p className="text-white/60 text-sm">
                The free trial includes access to all basic features for 14 days. Limited to one trial per IP address.
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-6 border border-white/10">
              <h3 className="text-white font-semibold mb-2">What happens after the trial?</h3>
              <p className="text-white/60 text-sm">
                After your 14-day trial, you'll need to subscribe to continue using the service. We offer a 50% discount on your first subscription!
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-6 border border-white/10">
              <h3 className="text-white font-semibold mb-2">Can I cancel anytime?</h3>
              <p className="text-white/60 text-sm">
                Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your billing period.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

