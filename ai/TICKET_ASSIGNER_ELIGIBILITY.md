# Ticket Assigner - Employee Eligibility Criteria

## Overview

The Ticket Assigner determines employee eligibility based on multiple factors to ensure optimal ticket assignment. This document explains the eligibility criteria and scoring system.

---

## Eligibility Criteria

### 1. **Status Check** (Primary Factor)

Employees are evaluated based on their current status:

| Status | Eligibility | Availability | Notes |
|--------|------------|--------------|-------|
| **Online** 🟢 | ✅ Eligible | ✅ Fully Available | Best for assignment |
| **Busy** 🟡 | ✅ Eligible | ⚠️ Limited | Can take high/urgent tickets |
| **Away** 🟠 | ✅ Eligible | ⚠️ Limited | Can take tickets but not preferred |
| **Lunch** 🍽️ | ⚠️ Conditional | ❌ Not Available | Can take urgent tickets only |
| **Break** ☕ | ⚠️ Conditional | ❌ Not Available | Can take urgent tickets only |
| **Meeting** 📅 | ⚠️ Conditional | ❌ Not Available | Can take urgent tickets only |
| **Training** 📚 | ⚠️ Conditional | ❌ Not Available | Can take urgent tickets only |
| **On Leave** 🏖️ | ❌ Not Eligible | ❌ Not Available | Cannot take any tickets |
| **Offline** ⚫ | ❌ Not Eligible | ❌ Not Available | Cannot take any tickets |

### 2. **Workload Check** (Secondary Factor)

Workload is calculated as: `(Current Tickets / Max Tickets) × 100%`

| Workload % | Eligibility | Availability | Notes |
|------------|------------|--------------|-------|
| **0-50%** | ✅ Eligible | ✅ Fully Available | Optimal for assignment |
| **50-70%** | ✅ Eligible | ✅ Available | Good for assignment |
| **70-90%** | ✅ Eligible | ⚠️ Limited | Prefer lower workload agents |
| **90-100%** | ⚠️ Conditional | ❌ Not Available | Only for urgent tickets |
| **100%+** | ❌ Not Eligible | ❌ Not Available | At maximum capacity |

**Default Max Tickets:** 10 per employee (configurable)

### 3. **Activity Check** (Tertiary Factor)

Recent activity is evaluated based on `last_seen` timestamp:

| Time Since Last Seen | Impact |
|---------------------|--------|
| **< 5 minutes** | ✅ Recently active - Best for assignment |
| **5-30 minutes** | ✅ Moderately active - Good for assignment |
| **30-60 minutes** | ⚠️ Less active - Reduced availability |
| **> 60 minutes** | ❌ Inactive - Not available |

---

## Eligibility Scoring System

Each employee receives an **eligibility score (0-100)** based on:

### Score Breakdown

1. **Status Score (0-40 points)**
   - Online: 40 points
   - Busy: 25 points
   - Away: 10 points
   - Other statuses: 0 points

2. **Workload Score (0-30 points)**
   - < 50% workload: 30 points
   - 50-70% workload: 20 points
   - 70-90% workload: 10 points
   - ≥ 90% workload: 0 points

3. **Activity Score (0-20 points)**
   - Active in last 5 minutes: 20 points
   - Active in last 30 minutes: 10 points
   - Inactive > 30 minutes: 0 points

4. **Priority Bonus (0-10 points)**
   - Handled by auto-assignment logic
   - Based on ticket priority and agent skills

### Total Score Calculation

```
Total Score = Status Score + Workload Score + Activity Score + Priority Bonus
Maximum Score = 100
```

---

## Sorting and Selection

### Employee List Sorting

Employees are sorted by:
1. **Eligibility Score** (descending) - Higher score first
2. **Availability** - Available employees first
3. **Ticket Count** (ascending) - Lower workload first

### Auto-Assignment Logic

When using "Auto Assign", the system:
1. Filters employees by status (online/busy preferred)
2. Calculates eligibility scores
3. Considers ticket priority
4. Selects the employee with the highest score
5. Falls back to any online employee if no perfect match

---

## Eligibility Reasons

Each employee's eligibility card shows detailed reasons:

### Example Reasons:
- ✅ "Status: Online - Fully available"
- ✅ "Workload: Low - Optimal for assignment"
- ✅ "Activity: Recently active"
- ⚠️ "Status: Busy - Can take high/urgent priority tickets"
- ⚠️ "Workload: High (70%+) - Prefer lower workload agents"
- ❌ "Status: Offline - Not available for ticket assignment"
- ❌ "Workload: At maximum capacity (100%+)"

---

## Configuration

### Default Settings

- **Max Tickets per Employee:** 10
- **Workload Thresholds:**
  - Low: < 50%
  - Moderate: 50-70%
  - High: 70-90%
  - Maximum: ≥ 90%

### Customization

These values can be customized in:
- `ai/ai/backend/app/api/ticket_assigner.py` - Eligibility logic
- `ai/ai/backend/app/services/agent_router.py` - Auto-assignment logic

---

## Examples

### Example 1: Highly Eligible Employee
- Status: Online 🟢
- Tickets: 2/10 (20% workload)
- Last Active: 2 minutes ago
- **Score: 90/100**
- **Eligibility: ✅ Fully Available**

### Example 2: Moderately Eligible Employee
- Status: Busy 🟡
- Tickets: 5/10 (50% workload)
- Last Active: 15 minutes ago
- **Score: 55/100**
- **Eligibility: ✅ Eligible (Limited)**

### Example 3: Not Eligible Employee
- Status: Offline ⚫
- Tickets: 0/10 (0% workload)
- Last Active: 2 hours ago
- **Score: 0/100**
- **Eligibility: ❌ Not Eligible**

---

## Best Practices

1. **For Urgent Tickets:**
   - Prefer employees with status "Online"
   - Prefer employees with workload < 50%
   - Prefer employees active in last 5 minutes

2. **For High Priority Tickets:**
   - Can assign to "Busy" employees
   - Can assign to employees with workload < 70%
   - Prefer employees active in last 30 minutes

3. **For Medium/Low Priority Tickets:**
   - Assign to employees with workload < 90%
   - Can assign to "Away" employees if needed
   - Distribute evenly across team

4. **Manual Assignment:**
   - Review eligibility reasons before assigning
   - Check workload percentage
   - Consider employee's current status
   - Use auto-assign for optimal distribution

---

## Troubleshooting

### No Eligible Employees Found

**Possible Causes:**
1. All employees are offline
2. All employees are at maximum capacity
3. All employees are on leave

**Solutions:**
1. Check employee statuses in Status Updater
2. Review ticket assignments to reduce workload
3. Adjust max tickets per employee if needed

### Employees Not Showing as Available

**Possible Causes:**
1. Employee status is not "online"
2. Employee has reached max ticket capacity
3. Employee has been inactive for > 1 hour

**Solutions:**
1. Ask employee to update status to "online"
2. Reassign some tickets to other employees
3. Check employee activity in Status History

---

## API Endpoints

### Get Eligible Employees
```
GET /api/ticket-assigner/eligible-employees
```

Returns:
- List of employees with eligibility scores
- Eligibility reasons for each employee
- Availability status
- Workload information

### Auto Assign Ticket
```
POST /api/ticket-assigner/auto-assign
Body: { "ticket_id": 123 }
```

Uses eligibility scoring to select best employee.

### Manual Assign Ticket
```
POST /api/ticket-assigner/assign
Body: { "ticket_id": 123, "assigned_to": "user_id" }
```

Manually assigns ticket to specified employee (bypasses eligibility check).

---

## Future Enhancements

- Skills-based matching
- Department-based routing
- Custom workload thresholds per employee
- Historical performance metrics
- Response time tracking
- Customer satisfaction scores

