# Subscription & Authentication System

## Overview
A comprehensive subscription and authentication system has been implemented with the following features:

### ✅ Features Implemented

1. **User Authentication**
   - Sign up with email/password
   - Login/Logout functionality
   - JWT token-based authentication
   - Session persistence

2. **Free Trial System**
   - 14-day free trial for new users
   - **IP-based restriction**: Only one free trial per IP address
   - Trial status tracking and expiration handling
   - Trial days remaining display

3. **Subscription Plans**
   - **Basic Plan**: $99/month (50% off first subscription)
     - 2 AI agents
     - Agent Builder, Customer Service Console, Knowledge AI
     - Status Updater
     - Ticket assigner and ticket solver
     - Basic analytics dashboard
     - Basic integrations (Zendesk, Jira)
     - Email support
     - 5,000 queries/month
   
   - **Advanced Plan**: $299/month (50% off first subscription)
     - 5 AI agents
     - Agent Builder, Customer Service Console, Knowledge AI
     - Status Updater, Premium Voice Studio
     - Ticket assigner and ticket solver
     - CRM workspace
     - Advanced analytics dashboard
     - Multi-channel support (Email, Chat, Social)
     - Workflow automation
     - All integrations (Zendesk, Jira, Salesforce, LinkedIn)
     - Priority support
     - 50,000 queries/month
   
   - **Enterprise Plan**: Contact for quotation
     - Unlimited AI agents
     - Agent Builder, Customer Service Console, Knowledge AI
     - Status Updater, Premium Voice Studio
     - Ticket assigner and ticket solver
     - CRM workspace
     - Enterprise analytics & reporting
     - Multi-channel support (Email, Chat, Social, Voice)
     - Workflow automation
     - All integrations + custom integrations
     - 24/7 dedicated support
     - Unlimited queries
     - Custom training & onboarding

4. **50% First Subscription Discount**
   - Automatically applied to first subscription
   - Displayed prominently on pricing page
   - Original price shown with strikethrough

5. **Integration Badges**
   - Active integrations displayed in header
   - Shows which tools are connected (Zendesk, Jira, etc.)
   - Visual indicators for active subscriptions

6. **Subscription Management**
   - Subscribe to plans (monthly/yearly)
   - Subscription status tracking
   - Automatic integration activation based on plan
   - Subscription history

## Database Models

### UserAccount
- User authentication and profile
- Subscription status tracking
- Trial period management
- IP address tracking for trial restriction

### SubscriptionPlan
- Plan definitions and pricing
- Features and integrations per plan

### Subscription
- Subscription history
- Payment tracking
- Discount tracking

### UserIntegration
- Active integrations per user
- Integration credentials (encrypted)
- Status tracking

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account with free trial
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info

### Subscription
- `GET /api/subscription/plans` - Get all available plans
- `POST /api/subscription/subscribe` - Subscribe to a plan
- `GET /api/subscription/status` - Get subscription status

## Frontend Pages

1. **Login Page** (`/auth/login`)
   - Email/password login
   - Link to signup

2. **Signup Page** (`/auth/signup`)
   - User registration
   - Automatic free trial activation
   - IP address detection

3. **Pricing Page** (`/pricing`)
   - Display all plans with pricing
   - 50% discount prominently shown
   - Subscribe buttons
   - FAQ section

## Header Integration

The header now displays:
- Active integration badges (when subscribed)
- Trial days remaining (if on trial)
- Login/Signup buttons (if not authenticated)
- Logout button (if authenticated)

## Security Features

1. **IP-based Trial Restriction**
   - Prevents multiple free trials from same IP
   - Enforced at signup

2. **Password Hashing**
   - SHA256 hashing (upgrade to bcrypt in production)

3. **JWT Tokens**
   - 30-day token expiration
   - Secure token generation

4. **Subscription Protection**
   - Premium features protected by subscription checks
   - Automatic trial expiration handling

## Usage Example

### Protecting Premium Features

```python
from app.api.auth import get_current_user
from app.utils.subscription import check_subscription_access

@router.get("/premium-feature")
async def premium_feature(user: UserAccount = Depends(get_current_user)):
    # Check if user has active subscription or trial
    check_subscription_access(user)
    
    # Or require specific plan
    check_subscription_access(user, required_plan="professional")
    
    # Your premium feature code here
    return {"message": "Premium feature accessed"}
```

## Installation & Setup

1. **Install Dependencies**
   ```bash
   cd ai/backend
   pip install -r requirements.txt
   ```

2. **Database Migration**
   - Database tables are automatically created on startup
   - Models are imported in `app/db/init_db.py`

3. **Environment Variables**
   - `SECRET_KEY`: JWT secret key (set a strong value in production)

## Pricing Strategy

Based on market research:
- **Entry-level SaaS average**: $29/month
- **Optimal conversion price**: $9-19/month for individuals
- **Our pricing**: $14.50-$49.50/month (with 50% discount)

## Next Steps

1. **Payment Integration**
   - Integrate Stripe/PayPal for actual payments
   - Handle payment webhooks

2. **Email Verification**
   - Add email verification for signups
   - Password reset functionality

3. **Enhanced Security**
   - Upgrade to bcrypt for password hashing
   - Add rate limiting
   - Implement CSRF protection

4. **Analytics**
   - Track subscription conversions
   - Monitor trial-to-paid conversion rates
   - User engagement metrics

## Notes

- Free trial is limited to one per IP address to prevent abuse
- 50% discount is automatically applied to first subscription
- Integrations are automatically activated based on subscription plan
- All subscription data is stored in the database for tracking

