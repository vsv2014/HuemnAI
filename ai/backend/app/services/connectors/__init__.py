from . import jira, zendesk, salesforce, greenhouse, linkedin

# real implementations
from . import real_jira, real_zendesk, real_salesforce, real_greenhouse, real_linkedin

# Switcher to real connectors if env variables present
from app.core.config import settings

USE_REAL = settings.USE_REAL_CONNECTORS

if USE_REAL:
    # replace modules with real ones
    jira = real_jira
    zendesk = real_zendesk
    salesforce = real_salesforce
    greenhouse = real_greenhouse
    linkedin = real_linkedin

# For now, exports are the modules
__all__ = ["jira", "zendesk", "salesforce", "greenhouse", "linkedin"]
