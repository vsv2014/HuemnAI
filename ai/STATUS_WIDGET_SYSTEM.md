# Status Widget System & Work Time Tracking

## Overview

The Status Widget System provides an embeddable widget that allows users to update their status and track work time across all subscribed tools. It appears in the header when users are logged in and can be embedded in third-party ticketing tools (Zendesk, Jira, etc.).

---

## Features

### 1. Status Widget Component
- **Location**: Header (when logged in) and Status Updater page
- **Functionality**: 
  - Shows current status with icon
  - Dropdown menu with subscribed tools
  - Quick status updates
  - Work time tracking

### 2. Extended Status Types (9 Total)
- 🟢 **Online** - Available and working
- 🟡 **Busy** - Working but busy
- 🟠 **Away** - Temporarily away
- 🍽️ **Lunch** - On lunch break
- ☕ **Break** - Taking a break
- 📅 **In Meeting** - In a meeting
- 📚 **Training** - In training session
- 🏖️ **On Leave** - On leave/vacation
- ⚫ **Offline** - Not available

### 3. Work Time Tracking
- Automatically tracks time spent in each status
- Calculates active work hours (Online + Busy time)
- Tracks by day, week, and month
- Individual employee breakdown
- Available in Analytics Dashboard

### 4. Subscribed Tools Display
- Shows all active integrations (Zendesk, Jira, Salesforce, etc.)
- Displays tool icons and status
- Quick access to tool management

---

## How It Works

### For Users

1. **Login** → Status Widget appears in header
2. **Click Widget** → See subscribed tools and status options
3. **Select Status** → Status updates instantly
4. **Work Time Tracked** → Automatically tracked in Analytics Dashboard

### Status Updater Page

- Navigate to: `/chat/status-updater`
- Shows all 9 status options as clickable buttons
- Displays subscribed tools
- Shows current status indicator
- No chat interface - direct status updates

---

## Database Schema

### StatusHistory Table

Tracks all status changes for work time calculation:

```sql
- id: Integer (Primary Key)
- user_id: String (Indexed)
- status: String (online, busy, away, lunch, break, meeting, training, leaves, offline)
- previous_status: String (Previous status before change)
- timestamp: DateTime (When status changed)
- duration_seconds: Float (Time spent in previous status)
- is_auto_update: String (true/false - manual vs automatic)
- activity_count: Integer (Activity count at time of change)
```

---

## API Endpoints

### Status Updates

**POST** `/api/status/`
```json
{
  "user_id": "user123",
  "status": "online"
}
```

**GET** `/api/status/{user_id}`
Returns current status and activity information.

### Widget API

**GET** `/api/widget/subscribed-tools`
Returns user's subscribed tools/integrations (requires authentication).

**GET** `/api/widget/embed.js`
Returns JavaScript embed script for third-party tools.

---

## Embedding in Third-Party Tools

### Option 1: Simple Script Tag

Add to your ticketing tool's HTML:

```html
<script src="http://localhost:3000/widget-embed.html"></script>
```

### Option 2: Manual Integration

1. Copy code from `ai/ai/frontend/public/widget-embed.html`
2. Add to your tool's custom HTML/JavaScript section
3. Widget appears in top-right corner

### Option 3: Browser Extension (Future)

A browser extension will automatically inject the widget into supported tools.

---

## Work Time Calculation

### How It Works

1. **Status Change** → Recorded in `status_history` table
2. **Duration Calculation** → Time spent in previous status is calculated
3. **Active Hours** → Online + Busy time = Active work hours
4. **Aggregation** → Grouped by day/week/month for analytics

### Metrics Tracked

- Total online hours
- Total busy hours
- Total away hours
- Total offline hours
- Active work hours (online + busy)
- Individual employee breakdown
- Today/Week/Month summaries

---

## Analytics Dashboard Integration

The Analytics Dashboard (`/chat/analytics-dashboard`) includes:

### Work Time Section

1. **Summary Cards**
   - Today Active Hours
   - This Week Active Hours
   - This Month Active Hours
   - Total Employees

2. **Charts**
   - Total Work Time by Status (Pie Chart)
   - Active Hours Comparison (Bar Chart)
   - Employee Work Time Table

3. **Employee Details**
   - Individual work time breakdown
   - Current status for each employee
   - Online/Busy/Away hours per employee

---

## Configuration

### Backend Settings

No additional configuration needed. The system automatically:
- Tracks status changes
- Calculates work time
- Stores history in database

### Frontend Settings

The widget automatically appears when:
- User is logged in
- User has an active subscription or trial
- Status Updater tool is available

---

## Troubleshooting

### Widget Not Appearing

1. **Check Authentication**: Make sure you're logged in
2. **Check Subscription**: Verify you have an active subscription or trial
3. **Check Browser Console**: Look for any JavaScript errors

### Status Not Updating

1. **Check Network**: Ensure backend is running on port 8001
2. **Check Authentication**: Verify token is valid
3. **Check Database**: Ensure `status_history` table exists

### Work Time Not Showing

1. **Update Status First**: Change your status at least once
2. **Wait for Calculation**: Work time is calculated from status history
3. **Check Analytics Dashboard**: Navigate to `/chat/analytics-dashboard`

---

## Database Reset Note

⚠️ **Important**: When new database models are added (like `status_history`), the database is recreated in development mode. This means:

- All user accounts are deleted
- All data is reset
- Users need to sign up again

**Solution**: In production, use database migrations instead of dropping/recreating tables.

---

## Files

### Backend
- `ai/ai/backend/app/db/models/status_history.py` - Status history model
- `ai/ai/backend/app/services/status_service.py` - Status tracking service
- `ai/ai/backend/app/api/status.py` - Status API endpoints
- `ai/ai/backend/app/api/widget.py` - Widget API endpoints
- `ai/ai/backend/app/api/analytics.py` - Analytics with work time

### Frontend
- `ai/ai/frontend/components/StatusWidget.tsx` - Widget component
- `ai/ai/frontend/app/chat/[tool]/StatusUpdaterPage.tsx` - Status Updater page
- `ai/ai/frontend/app/widget/status/page.tsx` - Widget status page
- `ai/ai/frontend/app/chat/analytics-dashboard/page.tsx` - Analytics dashboard
- `ai/ai/frontend/public/widget-embed.html` - Embed script

---

## Future Enhancements

- Browser extension for automatic widget injection
- Real-time status updates via WebSocket
- Status scheduling (auto-change at specific times)
- Team status visibility
- Status-based notifications
- Custom status types per organization

