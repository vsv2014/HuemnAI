# HUEMN.Ai Architecture Diagram

This document provides a high-level view of the system architecture and module relationships. It complements the overview in the root README.

## System Architecture

```mermaid
flowchart LR
    F[Next.js Frontend<br/>localhost:3000] -->|HTTP/WS /api/*| N[Nginx Reverse Proxy]
    N --> B[FastAPI Backend<br/>app.main:app]
    B -->|REST/WS| R1[Routers<br/>app/api/*]
    B -->|Background| S1[Schedulers<br/>knowledge_crawler, workflow]
    R1 --> SV[Services<br/>LLM, memory, routing, connectors, analytics, audit, ticket]
    SV --> DB[(Database<br/>SQLite/PG)]
    SV --> RD[(Redis<br/>Cache/Events)]
    SV --> EXT[External Connectors<br/>Jira, Zendesk, Salesforce, Greenhouse, LinkedIn, HubSpot, SAP, Zoho, ServiceNow]
    B -.-> WS[WebSockets<br/>voice_ws, ws_status, crm_ws]
```

### Key Links
- Backend entry: [main.py](file:///c:/Users/srava/huemn/ai/backend/app/main.py)
- Backend config: [config.py](file:///c:/Users/srava/huemn/ai/backend/app/core/config.py)
- Docker Compose: [docker-compose.yml](file:///c:/Users/srava/huemn/docker-compose.yml)
- K8s Backend: [backend.yaml](file:///c:/Users/srava/huemn/deploy/k8s/backend.yaml)
- K8s Frontend: [frontend.yaml](file:///c:/Users/srava/huemn/deploy/k8s/frontend.yaml)

## Module Map

```mermaid
flowchart TB
    Routers[app/api/*] --> Services[app/services/*]
    Services --> DBModels[app/db/models/*]
    Services --> LLMProviders[app/llm/*]
    Services --> EventBus[services/event_bus]
    EventBus --> SocketManager[services/socket_manager]
    LLMProviders --> Registry[llm/registry]
    DBModels --> Session[db/session]
```

### Notes
- Dev ports: backend http://127.0.0.1:8001, frontend http://localhost:3000
- Docker/K8s backend serves on 8000 behind Nginx; frontend is proxied via Nginx

## PlantUML

- Source file: [ARCHITECTURE.puml](file:///c:/Users/srava/huemn/ai/ARCHITECTURE.puml)
- Diagrams included:
  - SystemArchitecture
  - ModuleMap

```plantuml
@startuml SystemArchitecture
actor User
rectangle "Next.js Frontend\nlocalhost:3000" as FE
rectangle "Nginx Reverse Proxy" as N
rectangle "FastAPI Backend\napp.main:app" as BE
cloud "WebSockets\nvoice_ws, ws_status, crm_ws" as WS
database "PostgreSQL / SQLite (dev)" as DB
queue "Redis\nCache/Events" as RD
rectangle "Services Layer\nLLM, memory, routing, connectors,\nanalytics, audit, ticket" as SV
rectangle "External Connectors\nJira, Zendesk, Salesforce,\nGreenhouse, LinkedIn, HubSpot,\nSAP, Zoho, ServiceNow" as EXT
User --> FE
FE --> N : HTTP/WS /api/*
N --> BE
BE --> SV
SV --> DB
SV --> RD
SV --> EXT
BE ..> WS
@enduml
```
*** End Patch*** }``` ?>>
