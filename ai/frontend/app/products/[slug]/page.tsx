"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import dynamic from "next/dynamic";

const ProductDemo = dynamic(() => import("@/components/ProductDemo"), { ssr: false });

export default function ProductPage({ params }: { params: { slug: string } }) {
  // `params` may be a Promise in newer Next.js versions — use `React.use` to unwrap safely
  // this avoids the console warning about accessing `params.slug` directly
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { slug } = (React as any).use ? (React as any).use(params) : params;
  const router = useRouter();
  const { isAuthenticated, subscriptionStatus, trialDaysRemaining } = useAuthStore();
  const [product, setProduct] = useState<any>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    // Require authentication
    if (!isAuthenticated) {
      router.push(`/auth/login?redirect=${encodeURIComponent(`/products/${slug}`)}`);
      return;
    }

    // Check if user has active subscription or trial
    if (subscriptionStatus !== "trial" && subscriptionStatus !== "active") {
      router.push("/pricing");
      return;
    }

    // Check if trial expired
    if (subscriptionStatus === "trial" && trialDaysRemaining !== null && trialDaysRemaining <= 0) {
      router.push("/pricing");
      return;
    }

    // fetch product details from backend (best-effort)
    fetch(`${API_BASE}/api/products/${slug}`)
      .then((r) => r.json())
      .then((data) => setProduct(data))
      .catch(() => setProduct({ title: slug, desc: "" }));
  }, [slug, isAuthenticated, subscriptionStatus, trialDaysRemaining, router]);

  async function openChat() {
    try {
      await fetch(`${API_BASE}/api/actions/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: { name: product?.title || slug } }),
      });
    } catch {
      // ignore
    }
    router.push(`/chat?product=${encodeURIComponent(product?.title || slug)}`);
  }

  if (!isAuthenticated || (subscriptionStatus !== "trial" && subscriptionStatus !== "active")) {
    return null; // Will redirect
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row items-start gap-8">
        <div className="flex-1">
          <h1 className="text-4xl font-bold">{product?.title || slug}</h1>
          <p className="mt-4 text-white/70 max-w-2xl">{product?.desc || ""}</p>

          <div className="mt-6 flex gap-4">
            <button onClick={openChat} className="rounded-md bg-white px-5 py-2 text-black">
              Open Chat →
            </button>
            <a href="#features" className="rounded-md border border-white/10 px-5 py-2 text-white/80">
              View Features
            </a>
          </div>

          <section id="features" className="mt-10">
            <h3 className="text-2xl font-semibold">Features</h3>
            <ul className="mt-4 space-y-3 text-white/80">
              <li>• Human-like contextual conversations</li>
              <li>• Integrates with company knowledge and SOPs</li>
              <li>• Escalation and ticketing workflows</li>
              <li>• Actionable suggestions and automation hooks</li>
            </ul>
          </section>
        </div>

        <aside className="w-full md:w-80">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h4 className="font-semibold">Quick Demo</h4>
            <p className="mt-2 text-white/80 text-sm">Open chat tailored to this product to try a live demo.</p>
            <div className="mt-4">
              <button onClick={openChat} className="w-full rounded-md bg-white px-4 py-2 text-black">
                Try Demo
              </button>
            </div>

            <div className="mt-4">
              {/* Inline demo widget */}
              <ProductDemo prompt={product?.title || slug} />
            </div>
          </div>
        </aside>
      </div>

      <section className="mt-12">
        <h3 className="text-2xl font-semibold">Product UI Preview</h3>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-white/8 bg-white/3 p-4">
            <h4 className="font-semibold">Conversation Panel</h4>
            <div className="mt-3 text-white/70 text-sm">Example conversation and actions related to {product?.title || slug}.</div>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/3 p-4">
            <h4 className="font-semibold">Knowledge & Actions</h4>
            <div className="mt-3 text-white/70 text-sm">Cards, suggested actions, and knowledge references for this product.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
