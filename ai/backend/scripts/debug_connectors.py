from app.services.connectors import jira, zendesk, salesforce

print('jira:', jira.fetch_tickets())
print('zendesk:', zendesk.fetch_tickets())
print('salesforce:', salesforce.fetch_cases())
