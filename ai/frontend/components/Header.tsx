"use client";

import HumaneLogo from "./HumaneLogo";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-black/30 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-8 py-5 flex justify-between items-center">
        <HumaneLogo size="small" />

        <nav className="hidden md:flex gap-8 text-sm text-white/70">
          <a className="hover:text-white">Products</a>
          <a className="hover:text-white">Platform</a>
          <a className="hover:text-white">Docs</a>
        </nav>

        <button className="bg-white text-black px-4 py-2 rounded-md text-sm font-medium">
          Get in Touch
        </button>
      </div>
    </header>
  );
}
