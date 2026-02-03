from . import jira, zendesk, salesforce, greenhouse, linkedin, servicenow, sap, hubspot, zoho

# real implementations
from . import real_jira, real_zendesk, real_salesforce, real_greenhouse, real_linkedin
# Note: Real implementations for servicenow, sap, hubspot, zoho can be added similarly

# Switcher to real connectors if env variables present
from app.core.config import settings

USE_REAL = settings.USE_REAL_CONNECTORS

if USE_REAL:
    # replace modules with real ones where available
    jira = real_jira
    zendesk = real_zendesk
    salesforce = real_salesforce
    greenhouse = real_greenhouse
    linkedin = real_linkedin
    # Add others when real implementations exist

# Export all
__all__ = ["jira", "zendesk", "salesforce", "greenhouse", "linkedin", "servicenow", "sap", "hubspot", "zoho"]
