# Analytics Dashboard

## Overview

The Analytics Dashboard provides comprehensive insights into ticket performance, team workload, SLA metrics, and employee work time tracking with futuristic, animated visualizations.

---

## Features

### 1. Ticket Metrics

- **Total Tickets** - Overall ticket count
- **Solving Rate** - Percentage of resolved tickets
- **Pending Rate** - Percentage of pending tickets
- **Backlog** - Tickets older than 7 days
- **Critical Tickets** - Urgent and high priority tickets
- **Escalated** - Tickets escalated to higher levels

### 2. Inflow Tracking

- **Inflow Today** - Tickets created today
- **Inflow This Week** - Tickets created this week
- **Inflow This Month** - Tickets created this month

### 3. Team Workload

- **L1 Team Pending** - Tickets pending with Level 1 team
- **L2 Team Pending** - Tickets pending with Level 2 team
- **Escalated Count** - Number of escalated tickets

### 4. SLA Metrics

- **SLA Breached** - Tickets exceeding SLA time
- **SLA Satisfied** - Tickets resolved within SLA
- **SLA Pending** - Open tickets within SLA window
- **Breach Rate** - Percentage of breached tickets
- **Satisfaction Rate** - Percentage of satisfied tickets

### 5. Performance Metrics

- **Tickets per Day** - Average tickets created per day
- **Resolution Rate** - Percentage of resolved tickets
- **Escalation Rate** - Percentage of escalated tickets
- **Average Resolution Time** - Average time to resolve tickets

### 6. Work Time Tracking

- **Today Active Hours** - Active work hours today
- **This Week Active** - Active work hours this week
- **This Month Active** - Active work hours this month
- **Total Employees** - Number of employees tracked
- **Individual Breakdown** - Per-employee work time details

---

## Visualizations

### Charts Available

1. **Area Chart** - Ticket flow over time (Created vs Resolved)
2. **Pie Chart** - Priority distribution (Low, Medium, High, Urgent)
3. **Bar Chart** - Status distribution (Open, In Progress, Resolved, Closed)
4. **Radial Bar Chart** - SLA performance (Satisfied, Breached, Pending)
5. **Team Workload Chart** - L1 vs L2 pending tickets
6. **Work Time Pie Chart** - Total work time by status
7. **Active Hours Comparison** - Today vs Week vs Month

### Design Features

- **Futuristic Styling** - Gradient backgrounds, glowing effects
- **Animated Charts** - Smooth animations on load and interaction
- **Mechanical Animations** - Pulsing cards, shimmer effects
- **Responsive Design** - Works on all screen sizes
- **Dark Theme** - Modern dark UI with glassmorphism

---

## Access

### URL
```
http://localhost:3000/chat/analytics-dashboard
```

### From Home Page
1. Click "Analytics Dashboard" card
2. Navigate to dedicated analytics page

---

## API Endpoints

### Get Analytics Overview

**GET** `/api/analytics/overview`

Returns comprehensive analytics data including:
- Overview metrics
- Time series data
- Priority distribution
- Status distribution
- SLA metrics
- Performance metrics
- Work time data

### Get Analytics Trends

**GET** `/api/analytics/trends?days=30`

Returns trend data for the last N days.

---

## SLA Thresholds

Default SLA thresholds (in hours):

- **High Priority**: 4 hours
- **Medium Priority**: 24 hours
- **Low Priority**: 72 hours
- **Urgent**: 4 hours (same as high)

These can be customized in `ai/ai/backend/app/api/analytics.py`.

---

## Work Time Calculation

Work time is calculated from `status_history` table:

1. **Status Changes** → Recorded with timestamps
2. **Duration Calculation** → Time between status changes
3. **Status Aggregation** → Grouped by status type
4. **Active Hours** → Online + Busy time
5. **Time Periods** → Calculated for Today, Week, Month

---

## Data Requirements

### For Ticket Metrics
- Tickets must exist in the `tickets` table
- Tickets should have `status`, `priority`, `created_at`, `resolved_at` fields

### For Work Time Metrics
- Users must update their status at least once
- Status changes are stored in `status_history` table
- Current status is tracked in memory and database

---

## Troubleshooting

### No Data Showing

1. **Create Some Tickets** - Use Customer Service tool to create tickets
2. **Update Status** - Use Status Updater to change status
3. **Wait for Calculation** - Metrics are calculated in real-time

### Charts Not Loading

1. **Check Backend** - Ensure backend is running on port 8001
2. **Check Network** - Verify API calls are successful
3. **Check Console** - Look for JavaScript errors

### Work Time Not Appearing

1. **Update Status First** - Change your status using Status Widget
2. **Check Database** - Ensure `status_history` table exists
3. **Refresh Page** - Reload the analytics dashboard

---

## Files

- `ai/ai/backend/app/api/analytics.py` - Analytics API endpoints
- `ai/ai/frontend/app/chat/analytics-dashboard/page.tsx` - Dashboard UI
- `ai/ai/frontend/services/api.ts` - Analytics API functions

---

## Future Enhancements

- Real-time updates via WebSocket
- Custom date range selection
- Export to CSV/PDF
- Custom dashboard layouts
- Alert thresholds
- Team performance comparisons
- Historical trend analysis

