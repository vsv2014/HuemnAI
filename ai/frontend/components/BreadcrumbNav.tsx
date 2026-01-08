"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbNavProps {
  items?: BreadcrumbItem[];
  showBackButton?: boolean;
  backHref?: string;
  backLabel?: string;
}

export default function BreadcrumbNav({ 
  items, 
  showBackButton = true,
  backHref,
  backLabel 
}: BreadcrumbNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Auto-generate breadcrumbs from pathname if not provided
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (!pathname) return [];
    
    const pathParts = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];
    
    // Always start with Home
    breadcrumbs.push({ label: "Home", href: "/" });
    
    // Add Agents if we're in agent routes
    if (pathParts[0] === "agents") {
      breadcrumbs.push({ label: "Agents", href: "/agents" });
      
      // Add specific agent if we have an ID
      if (pathParts[1] && pathParts[1] !== "new") {
        breadcrumbs.push({ label: "Agent Builder", href: `/agents/${pathParts[1]}` });
        
        // Add sub-sections
        const sectionMap: Record<string, string> = {
          "settings": "App Settings",
          "genai": "GenAI Tools",
          "analytics": "Analytics",
          "testing": "Testing",
          "deploy": "Deploy",
          "users": "User Management",
          "flows": "Flows",
          "channels": "Channels",
        };
        
        const pageMap: Record<string, string> = {
          "profile": "App Profile",
          "languages": "Languages",
          "variables": "Variables",
          "integrations": "Integrations",
          "dev-tools": "Dev Tools",
          "advanced": "Advanced Settings",
          "changelogs": "Change Logs",
          "models": "Models Library",
          "prompts": "Prompts Library",
          "features": "GenAI Features",
          "dialoggpt": "DialogGPT",
          "safeguards": "Safeguards",
          "summary": "Analytics Summary",
          "intelligence": "AI Intelligence",
          "playground": "Playground",
          "utterance": "Utterance Testing",
          "regression": "Regression Testing",
          "publish": "Publish",
          "versions": "Versions",
          "import-export": "Import/Export",
          "roles": "Roles",
          "manage": "Manage Users",
          "start": "Start Flow",
          "exit": "Exit Flow",
          "digital": "Digital Channels",
          "routing": "Channel Routing",
          "voice": "Voice Channels",
        };
        
        // Add section
        if (pathParts[2] && sectionMap[pathParts[2]]) {
          breadcrumbs.push({ 
            label: sectionMap[pathParts[2]], 
            href: `/agents/${pathParts[1]}/${pathParts[2]}` 
          });
        }
        
        // Add page
        if (pathParts[3] && pageMap[pathParts[3]]) {
          breadcrumbs.push({ 
            label: pageMap[pathParts[3]], 
            href: pathname 
          });
        } else if (pathParts[2] && pageMap[pathParts[2]]) {
          breadcrumbs.push({ 
            label: pageMap[pathParts[2]], 
            href: pathname 
          });
        }
      } else if (pathParts[1] === "new") {
        breadcrumbs.push({ label: "Create Agent", href: pathname });
      }
    }
    
    return breadcrumbs;
  };

  const breadcrumbs = items || generateBreadcrumbs();
  const defaultBackHref = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].href : "/agents";
  const defaultBackLabel = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].label : "Back";

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else if (defaultBackHref) {
      router.push(defaultBackHref);
    } else {
      router.back();
    }
  };

  return (
    <div className="flex items-center gap-2 mb-4">
      {showBackButton && (
        <button
          onClick={handleBack}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors border border-blue-500/20 hover:border-blue-500/40"
        >
          <span>←</span>
          <span>{backLabel || defaultBackLabel}</span>
        </button>
      )}
      
      <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
        {breadcrumbs.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && <span className="text-white/30">/</span>}
            {item.href && index < breadcrumbs.length - 1 ? (
              <Link
                href={item.href}
                className="text-white/60 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={index === breadcrumbs.length - 1 ? "text-white font-medium" : "text-white/60"}>
                {item.label}
              </span>
            )}
          </div>
        ))}
      </nav>
    </div>
  );
}

