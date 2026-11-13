# Huemn enterprise AI implementation program

> Status: **in progress, not production-ready**. This is an engineering execution plan, not a claim of Artemis feature parity.
> Scope: `vsv2014/HuemnAI`; current source baseline `8d96e6c`. Check latest main before applying changes.

## North star

Deliver one production-proven AI service that accepts tenant-authorized knowledge, ingests/version-indexes it, retrieves evidence, produces cited answers, selects authorized tools, runs a human-approved business workflow durably, and provides a complete trace/evaluation record.

**Architecture default**: Next.js frontend -> modular FastAPI application with model, RAG, graph-runtime, and tool modules -> PostgreSQL (and indexed vector search where justified), Redis/Celery workers, private object/file storage, OpenTelemetry-compatible traces. Add microservices or a separate workflow engine only after evidence supports them. Huemn does not need to adopt Artemis's ABL/AgentIR DSL.

## Code in draft branches (NOT merged or fully integration-tested)

| PR | Engineering responsibility | Status |
| --- | --- | --- |
| [#1](https://github.com/vsv2014/HuemnAI/pull/1) | Private uploads, owner downloads, honest embedding failure/cosine behavior, persistent private-file volumes | Draft; file access and migration tests pending |
| [#2](https://github.com/vsv2014/HuemnAI/pull/2) | Agent graph/resource ownership, controlled import/export, private conversation access | Draft; legacy `user_id=NULL` backfill and two-account tests pending |
| [#3](https://github.com/vsv2014/HuemnAI/pull/3) | Block non-isolated generated Python execution; production secret/subscription safeguards | Draft; disabled execution needs UI handling; real sandbox remains TODO |
| [#4](https://github.com/vsv2014/HuemnAI/pull/4) | Shared frontend Tabs, class utility, TypeScript CI check | Draft; frontend build/browser tests pending |
| [#5](https://github.com/vsv2014/HuemnAI/pull/5) | Model/dimension provenance for embeddings and fail-closed RAG retrieval, disable unsafe shared-index fallback by default | Draft; **stacked on #1**; legacy embeddings need controlled reindex |

## Workstream A — Foundation, security, and release (P0)

- Reconcile all draft PRs and shared CI/Compose file changes in dependency order. Do not merge blind.
- Repair known main-branch agent executor syntax and frontend build/typecheck failures; verify a clean checkout builds and starts.
- Enable GitHub Actions for this fork; require passing Python compile/tests, frontend typecheck/build, and integration jobs.
- Enforce backend owner/tenant authorization for **every** agent, source, conversation, tool, and action endpoint; test anonymous and cross-account denial.
- Replace long-lived JWT issuance and unsalted password hashing with a versioned migration, revocation/refresh and password-hash upgrade plan. Do not invalidate sessions without a migration.
- Keep code execution disabled until a separately sandboxed, resource-limited, no-secrets executor exists.
- Audit and migrate pre-existing unowned agents, legacy uploaded files, and synthetic embedding rows. Never assign legacy data to arbitrary users.

**Exit gate:** reproducible CI, two-tenant HTTP authorization suite, no public document leakage, startup with secure configuration, validated migration/rollback.

## Workstream B — RAG/data plane (P1)

- Choose representative SOPs, tickets and documents; define question->relevant-source golden test records.
- Validate extraction and table/CSV/PDF/OCR quality with user data sanitized for tests.
- Introduce durable ingestion jobs and source versions; idempotent reindex, deletion, data retention and recovery.
- Implement evaluated chunking, overlap, token size checks and source citations.
- Preserve embedding provider/model/version/dimensions; reject mixed vector spaces, reindex legacy vectors.
- Benchmark current SQL JSON scans against PostgreSQL+pgvector with HNSW and filtered queries. Adopt vector indexing based on measured scale.
- Implement BM25 + dense hybrid retrieval, optional reranker, authorization prefilter, calibrated abstention and citation validity checks.
- Add retrieval diagnostics: source status, chunk count, indexed version, p95 embed/retrieve latency, filtered result IDs and quality metrics; redact sensitive text.

**Exit gate:** Recall@K, groundedness/citation regression suite and tenant ACL tests meet documented thresholds; deletion/reindex works.

## Workstream C — Model inference & AI services (P1)

- Consolidate model invocation, streaming/cancel, typed responses and failures behind provider-specific SDK adapters.
- Separate managed-provider credentials from user-owned BYOK with encrypted, tenant-bound storage and rotation.
- Maintain a tested model capability/retirement registry; prohibit deprecated model defaults.
- Enforce quotas, rate limits, timeouts, bounded retries, tool budgets, structured outputs and compatibility-aware failover.
- Log provider/model/config identity, latency, token usage and estimated cost without leaking prompts or keys.
- Add prompt/template versioning and repeatable model evaluation gates.

**Exit gate:** simulated provider 401/429/timeout and deprecation tests; streaming cancellation; cost/latency + quality traces; credential isolation.

## Workstream D — Agent graphs and durable workflow (P1)

- Reuse **one authoritative graph runtime**; replace overlapping prompt-to-plan execution with reviewable graph creation where possible.
- Typed node and tool schemas, bounded loops, explicit delegate vs handoff, trusted user/tenant principal propagation.
- Persist workflow states and versions, approval tickets, checkpoints, idempotency keys and durable timers.
- Run at least one Celery worker with readiness probes, atomic claims, retries/dead-letter handling and duplicate-event tests.
- Never perform side-effecting actions before user/backend authorization and approval when required.
- Verify graph and approval resume across process restart.

**Exit gate:** same request leads to one authorized ticket action; rejection executes none; restart/duplicate delivery preserves correctness.

## Workstream E — Tools, connectors, MCP (P1/P2)

- Certify one real customer connector end-to-end with OAuth scopes, revocation, token refresh, permission checks and metrics.
- Maintain a typed tool registry with explicit read/write/destructive classification, output validation and idempotency.
- Add MCP client/server interoperability only for a proven integration requirement; never treat MCP as authorization.
- Isolate connector errors and retries; never default to indexing full mailboxes/drives.

**Exit gate:** connector permission matrix, expired/revoked credential tests, destructive action approval, audit evidence.

## Workstream F — Evaluation, observability, guardrails (P1)

- Correlate request_id, run_id and trace context across ingestion -> embed -> retrieve -> rerank -> generate -> tool -> approval.
- Instrument trace spans and RED metrics, including p50/p95, errors, cost, source version and provider identity with PII-safe logging.
- Maintain gold RAG question sets, retrieval relevance/Recall@K, groundedness/citation checks, agent trajectory and tool-decision evaluation.
- Add prompt-injection tests, PII redaction, secret-leak denial, untrusted document/tool-output boundaries.
- Implement regression thresholds and deployment gates; retain user feedback and audit retention policy.

**Exit gate:** engineers can isolate an incorrect/slow/unauthorized AI response to a specific component and source version.

## Workstream G — One customer-proven product (P1)

First product workflow: **customer support triage from uploaded SOPs**.
1. Authorized upload and ingestion.
2. Retrieval of only tenant-visible evidence.
3. Cited response with abstention when confidence is insufficient.
4. Typed support ticket recommendation.
5. Human approval for a write.
6. Idempotent ticket creation, trace and confirmation.
7. Restart/retry/cancel/denial and customer acceptance tests.

**Exit gate:** complete staging demo plus test evidence, customer value metric and rollback strategy.

## Dependencies, release and coordination

1. Enable GitHub Actions on the fork; verify **main** health first.
2. Stabilize baseline and secure data access/execution; reconcile PR #1/#2/#3/#4, including overlapping CI and Compose changes.
3. Reconcile stacked PR #5 with the current head of PR #1, and run controlled reindex before enabling provenance gates in production.
4. Deliver full AI observability and RAG benchmark before tuning indexes/providers.
5. Prove durable approvals and one end-to-end support workflow; then expand templates and connectors.
6. Record actual build/test results, not just committed code. Keep changes draft until verified.

**Out of scope without evidence:** cloning Artemis's ABL DSL, adopting Kafka/Restate/Kubernetes merely for parity, training a foundation model, or promising all 137 business jobs before one working customer flow.

## Known blockers

- GitHub Actions currently reports **zero runs** on the fork. Enable workflows before relying on CI badges.
- GitHub Issues are currently disabled on this fork; use this plan until issues are enabled.
- Local/container environment in this chat cannot clone GitHub directly, so commits were inspected remotely but not built or integration-tested locally.
- Existing main may have additional defects not exposed by the supplied audit.

**Definition of done:** passing real CI, security tests, data migrations, runbook, staged end-to-end tests, proven deployment/rollback and measured AI quality. A draft PR or implementation plan is not completion.
