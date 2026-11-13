#!/usr/bin/env node
// Source-only UI audit, not a substitute for screenshots, WCAG, and browser tests.
import fs from "node:fs";
import path from "node:path";

const appDir = path.resolve("app");
const reportPath = path.resolve("reports/UI_AUDIT.md");

function findPages(directory) {
  let found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) found = found.concat(findPages(entryPath));
    else if (entry.name === "page.tsx" || entry.name === "page.jsx") found.push(entryPath);
  }
  return found;
}

function matches(text, regex) { return Array.from(text.matchAll(regex), item => item[0]); }
function sanitized(value) { return String(value).replace(/[\r\n|]/g, " ").trim(); }
const findings = findPages(appDir).map(file => {
  const text = fs.readFileSync(file, "utf8");
  const route = "/" + path.relative(appDir, path.dirname(file)).replaceAll(path.sep, "/");
  const colors = new Set(matches(text, /(?:bg|text|border|from|to|via|ring)-(?:blue|purple|violet|indigo|pink|red|orange|green|amber|cyan|teal|emerald|sky|slate|gray|zinc|neutral)-\d{2,3}|#[0-9a-fA-F]{6}\b/g));
  const hex = new Set(matches(text, /#[0-9a-fA-F]{6}\b/g));
  const responsive = matches(text, /\b(?:sm|md|lg|xl|2xl):/g).length;
  const risks = [];
  if (text.length > 75000) risks.push("oversized page module");
  if (colors.size > 30) risks.push("fragmented palette");
  if (hex.size > 12) risks.push("many arbitrary color literals");
  if (text.length > 3500 && responsive === 0) risks.push("no responsive utilities detected");
  if (/\b(?:mocked response|fake response|simulate voice input|coming soon)\b/i.test(text)) risks.push("possible simulated or incomplete experience");
  if (/fixed inset-0/.test(text) && responsive < 2) risks.push("full-screen mobile layout review");
  return { route, bytes: Buffer.byteLength(text, "utf8"), colors: colors.size, responsive, risks };
});
findings.sort((a, b) => b.risks.length - a.risks.length || b.colors - a.colors || b.bytes - a.bytes);
const lines = [
  "# Huemn frontend UI audit",
  "",
  "Source-level inventory: " + findings.length + " Next.js page routes.",
  "",
  "This report flags source patterns, not observed visual defects. Validate in a browser at 320, 375, 768 and 1280px; keyboard-only and 200% zoom. Confirm contrast with WCAG 2.2 AA tooling.",
  "",
  "| Route | Source KB | Color tokens | Responsive utilities | Review signals |",
  "| --- | ---: | ---: | ---: | --- |"
];
for (const item of findings) {
  lines.push("| " + sanitized(item.route) + " | " + (item.bytes / 1024).toFixed(1) +
    " | " + item.colors + " | " + item.responsive + " | " +
    sanitized(item.risks.join("; ") || "No static flags") + " |");
}
lines.push("", "## Design recommendations", "",
  "- Use consistent navy/slate backgrounds, readable white primary text and secondary slate labels.",
  "- One primary indigo/sky action color; reserve amber and rose for warning/error states.",
  "- Ensure >=44px touch targets, visible focus, responsive side panels and reduced motion.",
  "- Avoid fabricated model/agent outputs; show verified state and actionable errors.",
  "- Extract large page modules into panels, hooks and accessible components.",
  "", "Automated source review does not establish production readiness.", "");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, lines.join("\n"));
console.log("Audited " + findings.length + " routes; generated " + reportPath);
