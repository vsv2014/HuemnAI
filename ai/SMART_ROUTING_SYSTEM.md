# Smart Routing System

## Overview
A comprehensive smart routing system that automatically detects when users want to create tickets or connect with agents, and routes them to the Customer Service tool for proper troubleshooting and ticket creation.

## Features

### 1. **Intent Detection Across All Tools**
- Detects when user wants to "create a ticket" or "connect to an agent"
- Works in all tools: Knowledge AI, HR Services, Status Updater, Ticket Booking Agent
- Automatically routes to Customer Service tool

### 2. **Automatic Tool Switching**
- When intent is detected, automatically switches to Customer Service tool
- Seamless transition with user-friendly messages
- Preserves conversation context

### 3. **Smart Ticket Creation Flow**
- **Step 1**: Basic troubleshooting is performed first
- **Step 2**: Troubleshooting steps are shown to user
- **Step 3**: If user explicitly asks for ticket/agent, ticket is created
- **Step 4**: Ticket is assigned to best available agent
- **Step 5**: User receives confirmation with ticket ID

## How It Works

### Backend Detection

#### Knowledge AI Service
```python
def detect_ticket_intent(query: str) -> Dict:
    """Detects if user wants to create ticket or connect to agent"""
    # Returns: {"needs_ticket": bool, "needs_agent": bool, "should_route": bool}
```

When detected, Knowledge AI returns:
```json
{
  "type": "ROUTE_TO_CUSTOMER_SERVICE",
  "message": "Transfer message...",
  "target_tool": "customer_service",
  "original_query": "user's original message"
}
```

#### Context Analyzer
Enhanced `should_create_ticket()` function:
- Always returns `True` when user explicitly asks for ticket/agent
- Keywords detected:
  - Ticket: "create ticket", "open ticket", "submit ticket", etc.
  - Agent: "connect to agent", "talk to agent", "human agent", etc.

### Frontend Routing

#### Chat Store
- Detects `ROUTE_TO_CUSTOMER_SERVICE` response type
- Automatically switches tool to `CUSTOMER_SERVICE`
- Sends original query to Customer Service tool
- Displays routing message to user

#### Intent Detection Function
```typescript
function detectTicketIntent(text: string): {
  needs_ticket: boolean;
  needs_agent: boolean;
  should_route: boolean;
}
```

## Flow Diagram

```
User in Knowledge AI
    ↓
Asks: "I want to create a ticket"
    ↓
Intent Detected → ROUTE_TO_CUSTOMER_SERVICE
    ↓
Frontend switches to Customer Service tool
    ↓
Original query sent to Customer Service
    ↓
Basic Troubleshooting performed
    ↓
Troubleshooting steps shown
    ↓
Ticket created (because user explicitly asked)
    ↓
Ticket assigned to best agent
    ↓
User receives confirmation
```

## Supported Tools

All tools now support smart routing:

1. **Knowledge AI** ✅
   - Detects ticket/agent requests
   - Routes to Customer Service

2. **HR Services** ✅
   - Detects ticket/agent requests
   - Routes to Customer Service

3. **Status Updater** ✅
   - Detects ticket/agent requests
   - Routes to Customer Service

4. **Ticket Booking Agent** ✅
   - Detects ticket/agent requests (for support issues)
   - Routes to Customer Service

5. **Customer Service** ✅
   - Performs basic troubleshooting
   - Creates tickets when needed
   - Assigns to best agent

## Example Scenarios

### Scenario 1: User in Knowledge AI
**User**: "I want to create a ticket"
**System**:
1. Detects intent in Knowledge AI
2. Routes to Customer Service
3. Performs troubleshooting
4. Creates ticket
5. Assigns to agent
6. Confirms to user

### Scenario 2: User in HR Services
**User**: "I need to connect to an agent"
**System**:
1. Detects intent in HR Services
2. Routes to Customer Service
3. Performs troubleshooting
4. Creates ticket
5. Assigns to agent
6. Confirms to user

### Scenario 3: User in Customer Service
**User**: "I want to create a ticket"
**System**:
1. Performs basic troubleshooting first
2. Shows troubleshooting steps
3. Creates ticket (because user explicitly asked)
4. Assigns to best agent
5. Confirms to user

## Troubleshooting Steps

The system performs basic troubleshooting before creating tickets:

- **Login Issues**: Password reset, account verification
- **Payment Issues**: Payment method validation, transaction review
- **Email Issues**: Spam folder check, email verification
- **Performance Issues**: Network check, cache clearing
- **General Issues**: Error gathering, log checking

## Ticket Creation Logic

Tickets are created when:
1. ✅ User explicitly asks for ticket/agent
2. ✅ User needs help (has issue/problem)
3. ✅ User wants solution (fix/resolve)
4. ✅ Complex information request (>5 words)

Tickets are NOT created for:
- ❌ Simple greetings without issues
- ❌ Farewells
- ❌ Simple information requests

## Benefits

1. **Seamless User Experience**
   - No need to manually switch tools
   - Automatic routing based on intent

2. **Proper Troubleshooting**
   - Always attempts troubleshooting first
   - Reduces unnecessary tickets

3. **Smart Ticket Creation**
   - Only creates tickets when needed
   - Respects user's explicit requests

4. **Better Agent Assignment**
   - Tickets assigned to best available agent
   - Priority based on tone analysis

5. **Consistent Flow**
   - Same flow across all tools
   - Predictable user experience

## Technical Details

### Backend Files Modified
- `app/services/knowledge_service.py` - Added intent detection
- `app/services/context_analyzer.py` - Enhanced ticket creation logic
- `app/api/chat.py` - Already handles troubleshooting and ticket creation

### Frontend Files Modified
- `frontend/store/chatStore.ts` - Added routing logic for all tools
- Added `detectTicketIntent()` helper function

## Testing

To test the routing:
1. Go to Knowledge AI tool
2. Ask: "I want to create a ticket"
3. Should automatically switch to Customer Service
4. Should perform troubleshooting
5. Should create ticket
6. Should show confirmation

Repeat for other tools (HR Services, Status Updater, Ticket Booking Agent).

