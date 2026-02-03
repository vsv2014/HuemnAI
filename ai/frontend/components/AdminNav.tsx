"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, FileText, Users } from "lucide-react";

export default function AdminNav() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + "/");
  };

  return (
    <nav className="flex items-center gap-6 mb-8 border-b border-gray-800 pb-1">
      <Link 
        href="/admin/registry"
        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
          isActive("/admin/registry") 
            ? "border-blue-500 text-blue-400" 
            : "border-transparent text-gray-400 hover:text-white"
        }`}
      >
        <Shield className="w-4 h-4" />
        <span className="font-medium">Agent Registry</span>
      </Link>
      
      <Link 
        href="/admin/audit"
        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
          isActive("/admin/audit") 
            ? "border-blue-500 text-blue-400" 
            : "border-transparent text-gray-400 hover:text-white"
        }`}
      >
        <FileText className="w-4 h-4" />
        <span className="font-medium">Audit Logs</span>
      </Link>
    </nav>
  );
}
