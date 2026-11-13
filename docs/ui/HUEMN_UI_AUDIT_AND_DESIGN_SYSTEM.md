# HuemnAI — UI screen audit and design-system remediation

Audit date: 2026-11-13. Scope: source-level inspection of **24 prioritized routes** out of **78** `app/**/page.tsx` routes, plus shared navigation and `globals.css`. This is **not** a screenshot-based audit or a claim that every viewport renders correctly. Work in consolidated PR #8.

## Executive verdict

Product capabilities are obscured by too many visual languages and unverified screens. The primary issues are **consistency, usability, trust and responsive behavior**, not a shortage of gradients. The design direction is a calm enterprise workspace, with strong contrast, clear hierarchy and honest function states.

### Reference design tokens (existing CSS tokens introduced in PR #8)

| Role | Color | Use |
| --- | --- | --- |
| Canvas | `#0B1220` | App background |
| Surface | `#121D2E` | Cards, work panels |
| Raised surface | `#1B2940` | Menus and expanded controls |
| Border | `#36465E` | Visible control boundaries |
| Primary text | `#F4F7FB` | Body and headings |
| Secondary text | `#BBC9DD` | Supporting copy |
| Primary interactive | `#384AD2` | Main CTA, with proper text contrast |
| Focus | `#64D8FF` | Keyboard focus indicator |
| Destructive | rose | Delete/error only, not decorative |
| Success | emerald | Confirmed statuses only |
| Warning | amber | Warnings and degraded operation only |

Use **one blue-violet primary** and **sky as focus/secondary accent**; use success/error colors only for semantics. Do not use blue+purple+green+red CTAs together on every card. Avoid animated rainbow gradients, neon borders and glass blur in dense work areas. Reserve illustration/gradient effects for marketing surfaces.

## Observed high-priority issues

1. **Massive builder monolith** — `app/agents/[id]/page.tsx` is ~414 KB, with 103 distinct color tokens across inspected styles, six responsive utility occurrences and many placeholder mentions. `app/agent-builder/page.tsx` is ~111 KB, with 81 distinct colors and only two responsive utility occurrences. **Action:** split into graph canvas, node inspector, run/debug panel, toolbar and saved-version surfaces; centralize state in typed stores and use semantic tokens. *File size and classes indicate maintainability risk; they do not prove runtime failure.*
2. **Test experience fragmentation** — `app/agents/[id]/test/page.tsx` has no responsive breakpoint utilities in the examined source and used a hard-coded `ml-96` debug offset. **Changed:** debug trace is now a dismissible overlay drawer without fixed left margin. Test this with keyboard, touch, screen readers and mobile widths.
3. **Playground misleadingly simulated execution** — `app/agents/[id]/testing/playground/page.tsx` used a one-second timer to return canned content. **Changed:** now invokes the existing agent API, maintains session IDs and shows real trace/error states. *Backend runtime and E2E still require verification.*
4. **Model Library pointed at unsupported API paths** — `app/agents/[id]/genai/models/page.tsx` called `/agents/{id}/models`; existing backend uses `/api/config/`. **Changed:** the library reads authenticated tenant configurations and links to Settings. Does **not** claim provider runtime validation.
5. **Global CSS blocked interaction** — `styles/globals.css` applied `overflow:hidden!important` to every descendant of an agent builder. **Changed:** avoid global descendant scroll suppression, preserve scrollable editors/menus/canvas. Visually verify drag/zoom, flyouts and mobile.
6. **Navigation icon/contrast inconsistency** — `components/AppSidebar.tsx` mixes emojis, animated logo treatments, translucent text and blue-purple-gradient selected states. **Changed partially:** higher-contrast slate surfaces and sky selected state. **Remaining:** replace decorative emoji with one icon set, label collapsed icons, preserve clear active navigation.
7. **Admin trace density** — `app/admin/trace/[id]/page.tsx` has ~48 distinct color styles and zero responsive utility occurrences in inspected source. **Action:** two-column desktop and stacked mobile execution timeline, collapse long JSON payloads, redact secrets and add copy-on-demand; trace access is owner-checked.
8. **Agent Console density** — `app/customer-service/agent-console/page.tsx` has ~51 KB source, ~40 color tokens and only two responsive utility occurrences. **Action:** test 320/375/768/1024/1440 widths, responsive queue/call/details panes and keyboard navigation.
9. **Marketing vs app visual mismatch** — landing has ~37 responsive utility occurrences while many internal operational pages have few; smooth public-site animations should not dictate agent-builder performance.
10. **Possible static / unfinished product pages** — `app/agents/[id]/testing/regression/page.tsx`, `analytics/genai/performance/page.tsx`, `deploy/publish/page.tsx`, `marketplace/page.tsx` have zero direct `fetch` calls in the page source sample. **Verify** their child components and backend wiring before calling them stubs. Do not equate a missing direct fetch with a missing feature.
11. **Authentication responsiveness** — `app/auth/login/page.tsx` has ~26 color styles but no responsive utility occurrences in sampled source. Validate mobile overflow, field labels, password show/hide, autofill and error messages.
12. **Color states are not consistent** — `app/agents/page.tsx` previously used gradient Create, blue Edit, green Test, purple Integrate and red Delete in one card. **Changed partially:** calmer surfaces and semantic destructive states. Standardize primary/secondary/destructive hierarchy.

## Screen coverage

- **24 prioritized routes source scanned:** landing, global agent builder, agent listing/detail, test, models, knowledge, Settings, evaluation, trace detail, approvals, registry, publish, regression, GenAI overview/performance, CRM, chat, marketplace, voice, pricing, login, service console and agent integrations.
- **54 more page routes remain for per-screen inspection.** Their file inventory is available under `ai/frontend/app/**/page.tsx`. Prioritize onboarding, billing, voice, CRM, analytics, import/export and role management next.
- Inspect routed child components; direct `fetch` count and static class counts are **heuristics only**.

## Standardization requirements

### Navigation and information architecture
- Global nav: Home / Agents / Knowledge / Integrations / Runs / Evaluation / Settings.
- Inside an agent: Build / Knowledge / Test / Deploy / Analyze. Avoid 15+ expanded sidebar groups by default.
- Breadcrumb and current agent identity on each work page.
- Explicit save/saved/error state, history and exit confirmation for unsaved graph changes.

### Builder
- Canvas default fills remaining width without global scroll hacks.
- Zoom-to-fit, keyboard shortcuts, selection, connect/disconnect, undo/redo, automatic layout, accessible node labels.
- Consistent node ports and semantic status (unconfigured, invalid, ready, running, failed).
- Validate the graph before publish and show actionable per-node errors.
- Support 320px mobile by offering a list/inspector fallback; do not attempt full desktop drag-and-drop unchanged on a phone.

### Agent testing
- One authoritative playground, not competing mock chat pages.
- Backend-derived outputs and errors, per-execution trace, request ID, model identity when available, latency and token usage.
- Empty, loading, success, partial, unavailable-provider and failed states.
- Show citation/source links for RAG answers; never display synthetic success.

### Visual accessibility
- WCAG AA: body text contrast >=4.5:1, actionable controls / boundaries >=3:1.
- 44x44px recommended touch targets, visible keyboard focus and skip links.
- Legible secondary text; avoid text opacity below 60% on dense panels.
- Motion reduction, restrained shadows, `overflow-wrap` on errors/IDs, no fixed-width content overflow.
- Differentiate disabled, loading and unauthenticated states; don't rely on hue alone.

### Screen QA matrix (must pass before merging)
- Widths: 320, 375, 768, 1024, 1440px.
- Desktop: Chrome and Firefox. Mobile: Safari and Chrome.
- Keyboard-only: tab order, focus visibility, menu navigation, modal escape, graph keyboard alternatives.
- High zoom: 200%; reduced-motion on.
- Data cases: empty list, 1 record, 100+ records, long names, 401/403/429/500, network offline, partially configured model, failed RAG index.
- Validate: no horizontal overflow, clipped text, inaccessible content, phantom API success or spurious visual overlap.
- Capture before/after screenshots and a route-by-route issue tracker. No screenshots or browser test evidence are available in this audit.

## Next UI engineering changes (prioritized)

P0: make test + model pages truthful, fix overflow and auth errors, make main builder usable across responsive widths, eliminate fake success states.

P1: extract 413KB builder into typed components with predictable state; unify CSS tokens, controls, labels, toasts, error states and icons. Rationalize sidebar groups, accessibility and trace viewer.

P2: user onboarding, integration marketplace polish, advanced graphs and optional visual effects only after performance tests.

**Release standard:** source code review + typecheck/build + browser E2E screenshots + accessibility checks. This document tracks findings; it does not certify 78 screens as complete.
