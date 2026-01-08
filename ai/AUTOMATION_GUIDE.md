# Automation Guide - What's Automatic vs Manual

## 🎯 Overview

This guide explains what features work **automatically** out of the box and what requires **configuration** to become fully automatic.

---

## ✅ FULLY AUTOMATIC (Works Without Configuration)

### 1. **Ticket Management**
- ✅ **Automatic ticket creation** - Creates tickets from customer messages
- ✅ **Smart ticket reuse** - Reuses existing open tickets instead of creating duplicates
- ✅ **Automatic troubleshooting** - Collects basic troubleshooting info automatically
- ✅ **Ticket updates** - Automatically updates tickets with new conversation messages
- ✅ **Priority detection** - Automatically detects urgency from user tone

### 2. **Agent Assignment**
- ✅ **Automatic agent selection** - Selects best available agent based on:
  - Current workload
  - Skills match
  - Availability status
- ✅ **Smart reassignment** - Automatically reassigns if agent becomes unavailable
- ✅ **Load balancing** - Distributes tickets evenly across agents

### 3. **Status Tracking**
- ✅ **Automatic activity tracking** - Tracks user activity from frontend
- ✅ **Status updates** - Automatically updates status:
  - **Online** - Active within last 5 minutes
  - **Away** - Inactive for 5-15 minutes
  - **Offline** - Inactive for 15+ minutes
- ✅ **Background monitoring** - Runs continuously in background

### 4. **Knowledge AI (Enhanced)**
- ✅ **Automatic indexing** - Indexes tickets from database automatically
- ✅ **Daily reindexing** - Automatically reindexes every 24 hours
- ✅ **Semantic search** - Searches full ticket content, not just keywords
- ✅ **Contextual responses** - Generates unique responses for each query
- ✅ **Conversation history** - Remembers previous queries in the session
- ✅ **Smart fallbacks** - Works even without OpenAI API key (contextual mock responses)

### 5. **Tone & Sentiment Analysis**
- ✅ **Automatic tone detection** - Detects emotion, urgency, politeness
- ✅ **Adaptive responses** - Adjusts response style based on user tone
- ✅ **Priority adjustment** - Automatically sets ticket priority based on urgency

---

## ⚙️ REQUIRES CONFIGURATION (To Become Fully Automatic)

### 1. **External Ticketing Tools Integration**

**Current Status:** Uses mock connectors by default

**To Make Automatic:**
1. **Jira Integration:**
   - Add to `.env`: `JIRA_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`
   - Location: `ai/ai/backend/.env`

2. **Zendesk Integration:**
   - Add to `.env`: `ZENDESK_SUBDOMAIN`, `ZENDESK_EMAIL`, `ZENDESK_API_TOKEN`
   - Location: `ai/ai/backend/.env`

3. **Salesforce Integration:**
   - Add to `.env`: `SALESFORCE_USERNAME`, `SALESFORCE_PASSWORD`, `SALESFORCE_SECURITY_TOKEN`
   - Location: `ai/ai/backend/.env`

**After Configuration:**
- ✅ Tickets automatically created in external systems
- ✅ Tickets automatically synced from external systems
- ✅ Knowledge AI automatically learns from external tickets

---

### 2. **LLM Integration (For Better Responses)**

**Current Status:** Works with smart fallbacks, but better with API key

**To Make Fully Automatic:**
1. **OpenAI Integration:**
   - Add to `.env`: `OPENAI_API_KEY=your_key_here`
   - Location: `ai/ai/backend/.env`
   - Optional: `OPENAI_MODEL=gpt-4` (default: gpt-3.5-turbo)

2. **Azure OpenAI (Alternative):**
   - Add to `.env`: `AZURE_OPENAI_KEY`, `AZURE_OPENAI_ENDPOINT`
   - Location: `ai/ai/backend/.env`

**Without API Key:**
- ✅ Still works with smart contextual fallbacks
- ✅ Generates unique responses based on query content
- ⚠️ Responses are simpler but still contextual

**With API Key:**
- ✅ More intelligent, nuanced responses
- ✅ Better understanding of complex queries
- ✅ More natural conversation flow

---

### 3. **HR Services Integration**

**Current Status:** Uses mock LinkedIn/Greenhouse data

**To Make Automatic:**
1. **LinkedIn Integration:**
   - Add to `.env`: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
   - Location: `ai/ai/backend/.env`

2. **Greenhouse Integration:**
   - Add to `.env`: `GREENHOUSE_API_KEY`
   - Location: `ai/ai/backend/.env`

**After Configuration:**
- ✅ Real candidate search from LinkedIn
- ✅ Automatic job posting to Greenhouse
- ✅ Real-time candidate shortlisting

---

### 4. **Embeddings (For Better Semantic Search)**

**Current Status:** Uses fallback embeddings (works but basic)

**To Make Better:**
- Add to `.env`: `OPENAI_API_KEY=your_key_here`
- Optional: `OPENAI_EMBEDDING_MODEL=text-embedding-3-large`

**Without API Key:**
- ✅ Still works with character-based embeddings
- ✅ Semantic search still functional
- ⚠️ Less accurate than OpenAI embeddings

**With API Key:**
- ✅ Much more accurate semantic search
- ✅ Better ticket matching
- ✅ More relevant solutions

---

## 📋 Configuration Checklist

### Minimum (Works Out of Box)
- [x] Python 3.8+ installed
- [x] Node.js 16+ installed
- [x] Dependencies installed (`start_servers.bat` does this automatically)

### Recommended (Better Experience)
- [ ] `OPENAI_API_KEY` in `backend/.env` - For better LLM responses
- [ ] `OPENAI_EMBEDDING_MODEL` in `backend/.env` - For better semantic search

### Full Automation (Enterprise)
- [ ] Jira credentials in `backend/.env`
- [ ] Zendesk credentials in `backend/.env`
- [ ] Salesforce credentials in `backend/.env`
- [ ] LinkedIn API credentials in `backend/.env`
- [ ] Greenhouse API credentials in `backend/.env`

---

## 🔧 Configuration File Locations

### Backend Configuration
**File:** `ai/ai/backend/.env`

**Example:**
```env
# Database (automatic)
DATABASE_URL=sqlite:///./humane.db

# OpenAI (recommended)
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Jira (optional)
JIRA_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-token

# Zendesk (optional)
ZENDESK_SUBDOMAIN=yourcompany
ZENDESK_EMAIL=your-email@company.com
ZENDESK_API_TOKEN=your-token

# Salesforce (optional)
SALESFORCE_USERNAME=your-username
SALESFORCE_PASSWORD=your-password
SALESFORCE_SECURITY_TOKEN=your-token
```

### Frontend Configuration
**File:** `ai/ai/frontend/.env.local`

**Example:**
```env
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8001
```

---

## 🚀 What Happens After Configuration

### With OpenAI API Key:
1. **Knowledge AI** generates intelligent, contextual responses
2. **Semantic search** becomes more accurate
3. **Ticket responses** become more natural and helpful
4. **All tools** work with real AI capabilities

### With Ticketing Tool Credentials:
1. **Tickets** automatically created in your ticketing system
2. **Knowledge AI** learns from your real tickets
3. **Ticket sync** happens automatically
4. **Full integration** with your workflow

### With HR Tool Credentials:
1. **Real candidate search** from LinkedIn
2. **Automatic job posting** to Greenhouse
3. **Real-time shortlisting** with actual profiles
4. **Complete HR automation**

---

## 📊 Feature Matrix

| Feature | Without Config | With OpenAI Key | With Full Config |
|---------|---------------|-----------------|------------------|
| **Ticket Creation** | ✅ Automatic | ✅ Automatic | ✅ Automatic + External Sync |
| **Agent Assignment** | ✅ Automatic | ✅ Automatic | ✅ Automatic |
| **Status Tracking** | ✅ Automatic | ✅ Automatic | ✅ Automatic |
| **Knowledge AI** | ✅ Works (Basic) | ✅ Works (Smart) | ✅ Works (Smart + Real Data) |
| **Tone Analysis** | ✅ Automatic | ✅ Automatic | ✅ Automatic |
| **HR Services** | ✅ Mock Data | ✅ Mock Data | ✅ Real Data |
| **Semantic Search** | ✅ Basic | ✅ Advanced | ✅ Advanced + Real Tickets |

---

## 💡 Key Improvements Made

### Knowledge AI Enhancements:
1. ✅ **Unique Responses** - Each query gets a different, contextual response
2. ✅ **Conversation History** - Remembers previous queries in session
3. ✅ **Smart Fallbacks** - Works without API key with contextual responses
4. ✅ **Better Prompts** - More detailed prompts for better solutions
5. ✅ **Enhanced Context** - Includes more ticket details in analysis

### LLM Improvements:
1. ✅ **Contextual Mock Responses** - Even without API key, responses are unique
2. ✅ **Query-Based Responses** - Different responses for login, payment, email issues, etc.
3. ✅ **Better Streaming** - Smooth token-by-token responses

---

## 🎯 Summary

### **Works Automatically:**
- Ticket management and assignment
- Status tracking
- Basic knowledge AI
- Tone analysis
- All core features

### **Needs Configuration:**
- External tool integrations (Jira, Zendesk, etc.)
- OpenAI API key (for better responses)
- HR service credentials (for real data)

### **Bottom Line:**
**The system works fully automatically for core features.** Adding API keys and credentials enhances the experience but is **not required** for basic functionality.

---

## 📝 Next Steps

1. **Start the servers** - Use `start_servers.bat` (auto-installs dependencies)
2. **Test basic features** - Everything works without configuration
3. **Add OpenAI key** - For better AI responses (optional but recommended)
4. **Add tool credentials** - For full integration (optional)

**The system is designed to work out of the box, with optional enhancements available through configuration!** 🚀

