# Platform Batch Validation Report

## Overview
- Validates end-to-end functionality for agents, orchestrator, audit exports, attachments, and knowledge ingestion.
- Confirms data formats, API routes, UI flows, and error handling.
- Documents manual steps to run and expected outcomes.

## Prerequisites
- Backend is running on http://localhost:8000/.
- Frontend dev server is running on http://localhost:3000/.
- Dev mode auth bypass is active for general flows; some endpoints may still require tokens/permissions.
- WebSocket gateway is available for orchestrator graph sync.

## Backend Coverage
- Agents
  - Export: GET /api/agents/{agent_id}/export
  - Import: POST /api/agents/import (multipart: file, import_type=full|incremental)
  - Data in ZIP: agent.json, nodes.json, connections.json, flows.json, integrations.json
- Orchestrator
  - Prompt: POST /api/orchestrator/prompt
  - Export: POST /api/orchestrator/export (JSON: session_id)
  - Import: POST /api/orchestrator/import (multipart: file)
  - Data in ZIP: plan.json, flow.json, code/system_core.py, meta.json
- Audit
  - Export: GET /api/audit/export?format=csv|json|docx
  - CSV and JSON are always available; DOCX requires python-docx and returns a .docx file or plain-text fallback
- Tickets
  - Upload attachment: POST /api/tickets/upload (multipart: file) → returns /uploads URL
- Knowledge
  - Upload source: POST /api/knowledge/sources/upload (multipart: file, Form: name, auto_crawl) → requires auth

## Frontend Coverage
- Agent Import/Export Page (Agents → Deploy → Import & Export)
  - Import ZIP: choose “Full” or “Incremental”, uploads file, navigates to imported agent
  - Export ZIP: downloads agent_{id}.zip
- Agent Builder (AI Orchestrator)
  - Export session: downloads orchestrator_{sessionId}.zip
  - Import session: selects ZIP, restores session, connects WS to populate graph and code
- Admin → Governance Dashboard
  - Export audit logs: Excel (CSV), JSON, Word (DOCX)
- Ticket Console / Customer Service Chat
  - Attachment upload: file picker returns link and injects into message or ticket

## Scenarios and Steps

### 1) Agent Export → Full Import
- Create or open an agent
- Export: Agents → Deploy → Import & Export → Export (ZIP)
- Delete the agent (optional)
- Import: same page → File Type: ZIP → Import Type: Full → Select ZIP → Import
- Expected:
  - New agent appears
  - Nodes/connectors/flows match the exported topology
  - Entry node is set if a START node existed

### 2) Agent Incremental Import
- Modify agent properties (e.g., name, prompt)
- Export ZIP
- Import with Import Type: Incremental
- Expected:
  - Properties from agent.json update the target agent
  - Existing nodes/connections are preserved unless explicitly replaced

### 3) Orchestrator Prompt → Export → Import
- Prompt: Enter a description that includes steps analyze, plan, execute, validate, respond
- Export session: download orchestrator_{sessionId}.zip
- Import session: select ZIP in Agent Builder, verify graph and code
- Expected:
  - Graph nodes render with labels and positions
  - system_core.py appears in the code editor
  - WS events update UI progressively

### 4) Audit Exports (Excel/CSV, JSON, DOCX)
- Navigate Admin → Governance Dashboard
- Export CSV: Downloads audit_logs.csv
- Export JSON: Downloads audit_logs.json
- Export DOCX: Downloads audit_logs.docx (or txt fallback if docx is unavailable)
- Expected:
  - CSV columns: id, user_id, action, resource_type, resource_id, ip_address, timestamp, details
  - JSON array with the same fields
  - DOCX table with header row and audit entries

### 5) Ticket Attachment Upload
- Open Ticket Console or Customer Service Chat
- Click attachment picker and choose a file
- Expected:
  - Upload succeeds and returns a URL under /uploads/tickets/
  - UI shows the attachment and includes its link in messages as needed

### 6) Knowledge Document Upload
- Navigate to Knowledge area with an authenticated user
- Upload a .pdf/.docx/.txt/.md/.html/.csv/.json file and set name, auto_crawl
- Expected:
  - Source created and document processed
  - Content is chunked and optionally embedded for search
  - Crawl status progresses if auto_crawl

### 7) Voice Clone and STT
- Voice Studio: select audio samples and clone a voice
- STT: record audio in Customer Service Chat and send for transcription
- Expected:
  - Clone succeeds in dev/mock; provider credentials required in production
  - STT returns text inserted into input field

## Error and Edge Cases
- Invalid ZIP during import → 400 with “Invalid zip file”
- Missing plan.json/flow.json in orchestrator import → still creates session with available data
- Agent incremental import with unknown agent id → creates a new agent
- Audit DOCX when python-docx is not available → returns txt fallback
- Knowledge upload unauthenticated → 401/403 (requires token and permission)

## Data Format Details
- agent.json fields include: id (optional for incremental), name, description, agent_type, system_prompt, welcome_message, fallback_message, settings, tags, entry_node_id, version, is_active, is_public
- nodes.json: id, node_type, name, label, config, position_x/y, timeout, retry_count, error_handling, description, tags
- connections.json: id, source_node_id, target_node_id, condition, priority, label
- flows.json: id, name, description, flow_definition, is_active, is_default
- integrations.json: id, sub_agent_id, name, description, routing_condition, priority, pass_context, merge_response
- orchestrator plan.json: plan object from planner
- orchestrator flow.json: nodes and edges array with positions and metadata
- orchestrator code/system_core.py: generated or user-supplied runtime code

## Authentication Notes
- Many agent/orchestrator endpoints do not require auth in dev mode
- Knowledge and audit exports can be permission-gated
- For full batch automation, supply a dev token to frontend or REST calls where required

## Troubleshooting
- If downloads do not start, check browser popup/download permissions
- If UI does not update after import, verify WS connection to sync gateway is reachable
- If DOCX export fails, ensure python-docx is installed and accessible on server
- If knowledge upload fails, verify file type and token

## Outcome Summary
- Agent export/import ZIP is implemented and integrated with UI
- Orchestrator session export/import ZIP is implemented and integrated with Agent Builder
- Audit exports support CSV/JSON/DOCX with admin UI buttons
- Ticket attachments upload returns URLs and integrate into chat/ticket flows
- Knowledge document uploads process supported types with optional embeddings and crawl

## Next Enhancements
- Add PDF export for audits and reports if desired
- Add stricter validation for ZIP schemas and agent type coercion
- Extend orchestration code generation templates for richer runtime behaviors
