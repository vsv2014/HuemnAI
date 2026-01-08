# Connectors and Authentication

This project ships with mock connectors for common services and a pluggable model for real connectors.

Available mock connectors (default):
- Jira (mock)
- Zendesk (mock)
- Salesforce (mock)
- Greenhouse (mock)
- LinkedIn (mock)

To enable real connectors, set the environment variable `USE_REAL_CONNECTORS=1` and supply provider-specific environment variables. Example variables:

- JIRA_BASE_URL, JIRA_API_TOKEN, JIRA_USER
- ZENDESK_SUBDOMAIN, ZENDESK_API_TOKEN
- SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET, SALESFORCE_REFRESH_TOKEN
- GREENHOUSE_API_KEY
- LINKEDIN_ACCESS_TOKEN

Real connectors are not fully implemented in this starter and include skeleton client code. You can implement them in `app/services/connectors/` following the mock implementations' API (functions: `fetch_tickets()`, `create_ticket()` for ticketing; `post_job()`, `fetch_candidates()` for HR; `search_profiles()` for LinkedIn).

Security: store API keys in a secure secret store (CI secrets, cloud secret manager) and never commit them to source control.
