# HUMANE.OS Features Overview

## Complete Feature List

### 🤖 AI Tools

1. **Customer Service**
   - Conversational support
   - Ticket creation and management
   - Smart routing to agents
   - Multi-language support

2. **Ticket Assigner**
   - Automated ticket routing
   - Intelligent assignment to teams
   - L1/L2 team management
   - Priority-based assignment

3. **Knowledge AI**
   - Search knowledge base
   - SOP and document retrieval
   - Contextual solutions
   - Multi-language understanding

4. **HR Services**
   - Employee lifecycle support
   - Hiring and onboarding
   - Policy queries
   - HR-related assistance

5. **Status Updater** ⭐ NEW
   - Widget-based status updates (no chat interface)
   - 9 status types (Online, Busy, Away, Lunch, Break, Meeting, Training, On Leave, Offline)
   - Subscribed tools display
   - Work time tracking
   - Embeddable in third-party tools

6. **Ticket Booking Agent**
   - Multi-platform ticket booking
   - Flights, trains, buses, restaurants
   - Comparison and booking
   - Payment processing

7. **Analytics Dashboard** ⭐ NEW
   - Comprehensive ticket analytics
   - Performance metrics
   - SLA tracking
   - Work time analytics
   - Futuristic visualizations

---

## 🎯 Core Features

### Authentication & Subscription
- User signup and login
- JWT token-based authentication
- Free trial (14 days, one per IP)
- Tiered subscription plans (Basic, Professional, Enterprise)
- 50% discount on first subscription
- IP-based trial restriction

### Status Widget System
- Header widget (when logged in)
- Dropdown with subscribed tools
- Quick status updates
- Work time tracking
- Embeddable in third-party tools

### Work Time Tracking
- Automatic tracking from status changes
- Time spent in each status
- Active hours calculation (Online + Busy)
- Individual employee breakdown
- Today/Week/Month summaries

### Analytics & Reporting
- Ticket solving rate
- Pending rate
- Backlog tracking
- Inflow metrics
- SLA performance
- Team workload
- Employee work time

### Integrations
- Zendesk
- Jira
- Salesforce
- LinkedIn
- Greenhouse
- ServiceNow
- Slack
- Microsoft Teams
- GitHub
- GitLab
- Linear
- Asana
- Monday.com
- Trello
- Notion
- ClickUp
- Freshdesk
- Intercom
- HubSpot
- Pipedrive
- Airtable

### Smart Routing
- Automatic routing to Customer Service
- Intent detection (create ticket, connect to agent)
- Multi-language support
- Context-aware responses

### Multi-Language Support
- Language detection
- Contextual responses in user's language
- Supports 50+ languages
- Automatic language-aware routing

---

## 📊 Status Types

1. **Online** 🟢 - Available and working
2. **Busy** 🟡 - Working but busy
3. **Away** 🟠 - Temporarily away
4. **Lunch** 🍽️ - On lunch break
5. **Break** ☕ - Taking a break
6. **In Meeting** 📅 - In a meeting
7. **Training** 📚 - In training session
8. **On Leave** 🏖️ - On leave/vacation
9. **Offline** ⚫ - Not available

---

## 🎨 UI Features

### Design
- Futuristic dark theme
- Glassmorphism effects
- Animated gradients
- Glowing borders and shadows
- Mechanical animations
- Responsive design

### Components
- 3D floating product tiles
- Animated hero section
- Status widget
- Analytics dashboard
- Product cards with tilt effects
- Chat interfaces
- Rich message components

---

## 📁 Documentation Files

- `README.md` - Main setup guide
- `STATUS_WIDGET_SYSTEM.md` - Status widget documentation
- `ANALYTICS_DASHBOARD.md` - Analytics dashboard guide
- `SUBSCRIPTION_SYSTEM.md` - Subscription system details
- `CONFIGURATION_GUIDE.md` - Configuration instructions
- `START_SERVERS.md` - Server startup guide
- `TOOL_CONNECTOR_MAPPING.md` - Tool-connector mappings
- `MULTI_LANGUAGE_SUPPORT.md` - Language support details
- `SMART_ROUTING_SYSTEM.md` - Smart routing documentation
- `ENTERPRISE_SUBSCRIPTION.md` - Enterprise features

---

## 🚀 Quick Access

### Main Pages
- **Home**: http://localhost:3000
- **Login**: http://localhost:3000/auth/login
- **Signup**: http://localhost:3000/auth/signup
- **Pricing**: http://localhost:3000/pricing
- **Demo Request**: http://localhost:3000/demo-request

### Tools
- **Customer Service**: http://localhost:3000/chat/customer-service
- **Ticket Assigner**: http://localhost:3000/chat/ticket-assigner
- **Knowledge AI**: http://localhost:3000/chat/knowledge-ai
- **HR Services**: http://localhost:3000/chat/hr-services
- **Status Updater**: http://localhost:3000/chat/status-updater
- **Ticket Booking Agent**: http://localhost:3000/chat/ticket-booking-agent
- **Analytics Dashboard**: http://localhost:3000/chat/analytics-dashboard

### API
- **Backend**: http://127.0.0.1:8001
- **API Docs**: http://127.0.0.1:8001/docs
- **Health Check**: http://127.0.0.1:8001/health

---

## ⚠️ Important Notes

### Database Reset
In development mode, when new models are added, the database is recreated. This means:
- All user accounts are deleted
- All data is reset
- Users need to sign up again

**Solution**: Use database migrations in production.

### Authentication Required
Most features require authentication:
- Status Widget (header)
- Analytics Dashboard
- Work Time Tracking
- Subscribed Tools

### Subscription Bypass
Set `BYPASS_SUBSCRIPTION=1` in backend `.env` to bypass subscription checks during development.

---

## 🔧 Configuration

### Required
- Backend running on port 8001
- Frontend running on port 3000
- Database initialized (automatic on startup)

### Optional
- OpenAI API key for real AI responses
- SMTP configuration for email sending
- Connector credentials for third-party integrations

See `CONFIGURATION_GUIDE.md` for detailed configuration instructions.

