# Huemn UI/UX audit — source-based, not a browser visual sign-off

**Scope:** Agent Builder, agent catalog, Agent Playground, Model Library, App Header, App Sidebar, global styling, and key navigation flows. This review is based on actual React/CSS source. The app could not be started here (repository cloning and dependency installation have no external network access), so screenshots, computed CSS contrast, touch testing, and visual regressions remain **unverified**.

## Executive finding

The primary weakness is inconsistency rather than a single bad hue. The current implementation combines dark navy panels, neon blue/purple/pink/cyan/red gradients, floating/rainbow logo effects, very low-opacity surfaces, and local page color choices. Source review found at least 67 distinct color-related Tailwind/hex tokens inside the large agent-builder page alone. This increases noise and weakens hierarchy, especially when real execution errors and approval warnings must be distinguished from decoration.

## Confirmed code issues and fixes

| Severity | Screen / source | Confirmed problem | Change in this PR | Remaining verification |
|---|---|---|---|---|
| P0 | Agent Playground (`app/agents/[id]/testing/playground/page.tsx`) | `setTimeout` returned the literal fake assistant message instead of calling the agent runtime | Integrated real `processAgentMessage`, session tracking, trace viewer, explicit errors, accessible form | Two-user e2e, graph execution, mobile chat and keyboard |
| P0 | Model Library (`app/agents/[id]/genai/models/page.tsx`) | Page calls `/agents/{id}/models` but existing backend uses `/api/config` | Read authenticated masked `/api/config/?provider_type=llm`; manage keys via Settings | Permission boundaries, provider health, retired models |
| P0 | Agent Builder/global CSS (`styles/globals.css`) | `html:has([data-agent-builder]) * { overflow: hidden !important; }` disabled descendant scrolling, including tool panels and modals | Removed global descendant selector and fixed-position body trap | Mobile canvas, dialogs, overlays, resize and scroll lock |
| P1 | App Header (`components/AppHeader.tsx`) | `touchAction: 'none'` blocks expected touch interactions on header | Restore normal touch handling; calm navbar surface | iOS and Android manual testing |
| P1 | Root CSS (`styles/globals.css`) | Selector forcibly changed `header.fixed` to sticky, overriding component intent | Removed global fixed/sticky override | Scroll through all marketing and editor pages |
| P1 | Agent Catalog (`app/agents/page.tsx`) | Mixed blue/purple CTAs, green/purple/red actions, glowing cards competing with status | More restrained primary CTA, neutral cards, consistent semantic actions, responsive wrapping | 320/375/768/1024/1440px browser screenshots |
| P1 | App Sidebar (`components/AppSidebar.tsx`) | Heavy gradients and inconsistent active-state color compared with form pages | Neutral slate surface and sky active-state affordance | Collapsed/sidebar overlap, aria-current, scroll nav |
| P1 | Design system (`tailwind.config.js`, `styles/globals.css`) | No consistent set of semantic workspace tokens | Added page/surface/border/text/focus/primary/danger tokens, focus-visible and reduced-motion behavior | Contrast evaluation and legacy page migration |
| P1 | Agent Builder (`app/agent-builder/page.tsx`) | Approx. 111KB single React component with many inline node/editor styles and gradients; hard to safely maintain | **Not refactored** in this PR | Split graph canvas, node palette, inspector, provider selector, execution console, toolbar; add per-component tests |
| P1 | Global styling (`styles/globals.css`) | Approx. 32KB global CSS overrides ReactFlow and headers, including repeated high-specificity rules | Fixed most dangerous global constraints; introduced scoped workspace tokens | Refactor legacy overrides behind builder namespace, remove duplicates, CSS visual tests |
| P2 | App shell (`app/layout.tsx`) | Always-mounted animated background and rainbow elements compete with task-oriented enterprise UI | **Not fully redesigned** | Route-specific visual policies and reduced-motion page tests |

## Recommended cohesive palette

Use semantic role names, not a different gradient per feature. Baseline dark palette:

| Role | Color | Usage |
|---|---|---|
| Page background | `#0B1220` | Workspace canvas |
| Primary surface | `#121D2E` | Cards, panels |
| Raised surface | `#1B2940` | Menus and hover |
| Border | `#36465E` | Dividers and control outlines |
| High emphasis text | `#F4F7FB` | Titles and critical values |
| Muted text | `#BBC9DD` | Descriptions, labels |
| Primary accent | `#7084FF` | Selected controls, links |
| High contrast primary CTA | `#384AD2` | Action buttons with white text |
| Focus outline | `#64D8FF` | Keyboard focus |
| Warning / attention | restrained amber | Approval pending, latency degradation |
| Success | restrained emerald | Successful execution |
| Error | restrained rose | Model failure, security rejection |

Avoid red/green as the only error signal. Use icon, heading and explanatory text. Contrast ratios must be calculated using rendered foreground/background pairs—not guessed from hex values.

## Layout and interaction standards

- One main page heading, one clearly preferred primary CTA, maximum one saturated accent per region.
- Default content width 1120–1280px; avoid full-width text paragraphs.
- Common 8/12/16/24/32px spacing rhythm, consistent 12px inputs and 16px card radii.
- Minimum 44px interactive targets on mobile.
- Every destructive tool, agent deletion, publication or billing action needs an explicit confirmation.
- Every async operation must provide loading, empty, success, failure and retry behavior—never simulated production success.
- Keep agent graph operations keyboard-accessible and show connection/validation errors without color-only cues.
- Ensure debug traces do not show raw secrets or unrelated customer records.
- Separate studio routes from marketing animations and excessive blur for better editor frame rate.

## Browser audit checklist (required before merge)

1. Capture baseline vs PR at 360x800, 390x844, 768x1024, 1280x800, 1440x900.
2. Inspect Home, Catalog, New Agent, Graph Builder, Agent Test, Playground, Models, Knowledge, Settings, Approval, Evaluation and Trace routes.
3. Test mobile sidebar collapse/expand, keyboard arrows and Tab order, focus visibility, pointer touch-action, dialogs, long node labels, high zoom and browser font scaling.
4. Test light/dark surfaces, both configured/error/no-config model states, 401/403/429/timeout/500 messages, no knowledge results, slow agent graph.
5. Run axe-core/WCAG 2.2 AA audits, actual contrast analysis and Playwright screenshot diffs; document before/after fixes.
6. Measure bundle weight, ReactFlow drag FPS, input-to-response latency, layout shift and CPU overhead of animated backgrounds.

## Product UX judgment

**High severity:** Fake Playground, wrong Model Library API, global scroll/touch traps, weak failure clarity.

**Medium severity:** Fragmented color vocabulary, overly translucent surfaces, excessive gradients/glows, hard-to-maintain editor monolith.

**Lower severity:** Branding/animation polish, low-priority transitions and decorative icon consistency.

This is a first engineering/UI pass, **not a claim that all screens are visually perfect or production-ready**.

## Follow-up audit: all page inventory and additional functional fixes

The latest repository tree contains **78 Next.js page route files**. The previous table is a representative source review, **not** a claim of screenshot coverage for all 78 pages.

The new `ai/frontend/scripts/audit-ui.mjs` script can enumerate every route and produce `ai/frontend/reports/UI_AUDIT.md` with source-size, color-token and breakpoint heuristics. The report is posted to GitHub Actions job summaries; its flags are review prompts, not visual contrast measurements.

New observed issues and source changes on this consolidated branch:

- **Agent editor** (`app/agents/[id]/page.tsx`): approximately **414 KB** TSX page, source scan encountered over 100 distinct palette expressions and relatively few responsive breakpoints. Component extraction and mobile screenshots remain mandatory.
- **Orchestrator builder** (`app/agent-builder/page.tsx`): prominent `Save System` button had **no click handler**, while the header claimed `Turbo Mode Active` without a substantiated measurement. These misleading controls were removed or relabeled; header wrapping and shell sizing were improved, not yet browser-tested.
- **Legacy agent test** (`app/agents/[id]/test/page.tsx`): `Simulate Voice Input` was just a delayed preset text send and could read stale state. It was replaced with a clearly labeled, manually sent **sample greeting**.
- **Agent runtime**: exceptions could send Python traceback strings to clients and silently return a fallback as a successful answer. The error contract now provides an explicit failure indicator and omits raw server tracebacks.
- **Trace viewer**: the backend accessed a nonexistent `AgentConversation.status` field, failing requests with events. It now derives session state from persisted `is_active`/`ended_at`.

**Still outstanding:** actual browser QA, WCAG AA contrast calculations, decomposition of the 414 KB graph editor, real voice input on test pages, model/provider integration tests, and full agent workflow restart/approval verification.
