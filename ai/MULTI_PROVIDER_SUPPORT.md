# Multi-Provider LLM & Integration Support

## ✅ All LLM Providers Supported

The system now automatically detects and uses the best available LLM provider:

### 1. **OpenAI** (Priority 1)
- **Environment Variables:**
  - `OPENAI_API_KEY` - Your OpenAI API key
  - `OPENAI_MODEL` - Model name (default: gpt-3.5-turbo)
  - `OPENAI_EMBEDDING_MODEL` - Embedding model (default: text-embedding-3-small)

### 2. **Azure OpenAI** (Priority 2)
- **Environment Variables:**
  - `AZURE_OPENAI_KEY` - Azure OpenAI API key
  - `AZURE_OPENAI_ENDPOINT` - Azure endpoint URL
  - `AZURE_OPENAI_API_VERSION` - API version (default: 2024-02-15-preview)
  - `AZURE_OPENAI_DEPLOYMENT_NAME` - Deployment name (default: gpt-35-turbo)

### 3. **Auto-Detection**
- System automatically detects which provider has keys configured
- Uses the best available provider
- Falls back gracefully if no keys are configured

---

## ✅ All Integrations Supported

### Ticketing Tools

#### **Jira**
- **Environment Variables:**
  - `JIRA_URL` - Your Jira instance URL (e.g., https://company.atlassian.net)
  - `JIRA_EMAIL` - Your Jira email
  - `JIRA_API_TOKEN` - Jira API token

- **Features:**
  - Create tickets automatically
  - Fetch existing tickets
  - Sync tickets to knowledge base

#### **Zendesk**
- **Environment Variables:**
  - `ZENDESK_SUBDOMAIN` - Your Zendesk subdomain
  - `ZENDESK_EMAIL` - Your Zendesk email
  - `ZENDESK_API_TOKEN` - Zendesk API token

- **Features:**
  - Create tickets automatically
  - Fetch existing tickets
  - Sync tickets to knowledge base

#### **Salesforce**
- **Environment Variables:**
  - `SALESFORCE_USERNAME` - Salesforce username
  - `SALESFORCE_PASSWORD` - Salesforce password
  - `SALESFORCE_SECURITY_TOKEN` - Security token

- **Features:**
  - Create cases automatically
  - Fetch existing cases
  - Sync cases to knowledge base

### HR Tools

#### **Greenhouse**
- **Environment Variables:**
  - `GREENHOUSE_API_KEY` - Greenhouse API key

- **Features:**
  - Post jobs automatically
  - Fetch candidates
  - Shortlist candidates

#### **LinkedIn**
- **Environment Variables:**
  - `LINKEDIN_CLIENT_ID` - LinkedIn OAuth client ID
  - `LINKEDIN_CLIENT_SECRET` - LinkedIn OAuth client secret
  - `LINKEDIN_ACCESS_TOKEN` - LinkedIn access token

- **Features:**
  - Search candidate profiles
  - Post job listings
  - Fetch profile data

---

## 🔧 Configuration Methods

### Method 1: Environment Variables (.env file)

Create or edit `ai/ai/backend/.env`:

```env
# LLM Configuration (choose one or both)
OPENAI_API_KEY=sk-your-openai-key-here
# OR
AZURE_OPENAI_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/

# Jira Integration
JIRA_URL=https://company.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-jira-token

# Zendesk Integration
ZENDESK_SUBDOMAIN=yourcompany
ZENDESK_EMAIL=your-email@company.com
ZENDESK_API_TOKEN=your-zendesk-token

# Salesforce Integration
SALESFORCE_USERNAME=your-username
SALESFORCE_PASSWORD=your-password
SALESFORCE_SECURITY_TOKEN=your-security-token

# Greenhouse Integration
GREENHOUSE_API_KEY=your-greenhouse-key

# LinkedIn Integration
LINKEDIN_CLIENT_ID=your-client-id
LINKEDIN_CLIENT_SECRET=your-client-secret
LINKEDIN_ACCESS_TOKEN=your-access-token
```

### Method 2: UI Configuration

1. Open the application at http://localhost:3000
2. Click the **"⚙️ Configure Tools"** button
3. Select your connector (Jira, Zendesk, Salesforce)
4. Enter your credentials
5. Click "Configure"

---

## 🚀 How It Works

### LLM Auto-Detection

1. System checks for `OPENAI_API_KEY` first
2. If not found, checks for `AZURE_OPENAI_KEY` and `AZURE_OPENAI_ENDPOINT`
3. Uses the first available provider
4. Falls back to smart contextual responses if no keys configured

### Integration Auto-Detection

1. System checks for connector environment variables on startup
2. Validates credentials if `validate()` function exists
3. Enables connectors automatically if credentials are valid
4. Connectors work seamlessly with ticket creation and knowledge base

---

## 📋 Example Configuration

### Minimal Setup (OpenAI only)
```env
OPENAI_API_KEY=sk-your-key-here
```

### Full Setup (All providers)
```env
# LLM
OPENAI_API_KEY=sk-your-key-here

# Ticketing
JIRA_URL=https://company.atlassian.net
JIRA_EMAIL=user@company.com
JIRA_API_TOKEN=your-token

ZENDESK_SUBDOMAIN=company
ZENDESK_EMAIL=user@company.com
ZENDESK_API_TOKEN=your-token

# HR
GREENHOUSE_API_KEY=your-key
LINKEDIN_ACCESS_TOKEN=your-token
```

---

## ✅ Verification

### Check LLM Provider
- Backend logs will show which LLM provider is being used
- Check console for "Using OpenAI" or "Using Azure OpenAI" messages

### Check Integrations
- Try creating a ticket - it should sync to your configured tool
- Check Knowledge AI - it should learn from your external tickets
- Try HR services - should use real LinkedIn/Greenhouse if configured

---

## 🎯 Benefits

1. **Flexibility** - Use any LLM provider you have access to
2. **Auto-Detection** - No manual configuration needed
3. **Graceful Fallback** - Works even without API keys
4. **Full Integration** - All major tools supported
5. **Easy Setup** - Configure via UI or environment variables

---

**The system now supports ALL LLM providers and ALL integrations!** 🎉

