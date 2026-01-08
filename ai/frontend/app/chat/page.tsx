"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Page() {
  const router = useRouter();

  // Redirect to home if user lands on /chat without a specific tool
  useEffect(() => {
    router.push("/");
  }, [router]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold mb-4">Select a Tool</h1>
        <p className="text-white/60 mb-8">Choose a tool from the home page to get started.</p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all"
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
}
