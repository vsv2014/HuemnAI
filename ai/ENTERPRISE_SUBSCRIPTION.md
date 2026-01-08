# Enterprise Subscription for Companies

## Overview
The Enterprise plan has been enhanced specifically for companies and organizations with advanced features and team management capabilities.

## Enterprise Plan Features

### Pricing
- **Monthly**: $299/month (50% off first subscription = $149.50)
- **Yearly**: $2,990/year (50% off first subscription = $1,495)
- **Original Pricing**: $299/month, $2,990/year

### Enterprise-Specific Features

1. **Multi-User Team Management**
   - Unlimited team members
   - Role-based access control
   - Team collaboration features

2. **Company/Organization Dashboard**
   - Centralized management for all team members
   - Usage analytics and reporting
   - Billing and subscription management

3. **SSO (Single Sign-On) Support**
   - Integration with company identity providers
   - Secure authentication for enterprise users

4. **Custom Branding & White-Labeling**
   - Company logo and branding
   - Custom domain support
   - Branded user interface

5. **Dedicated Account Manager**
   - Personal support representative
   - Priority assistance

6. **SLA Guarantees**
   - Uptime guarantees
   - Performance SLAs
   - Support response time commitments

7. **Priority Feature Requests**
   - Direct input into product roadmap
   - Custom feature development

8. **On-Premise Deployment Option**
   - Self-hosted deployment
   - Data sovereignty
   - Enhanced security for sensitive data

### All Standard Features Included
- Unlimited AI agents
- All integrations (Zendesk, Jira, Salesforce, LinkedIn, Greenhouse)
- Custom integrations support
- 24/7 dedicated support
- Unlimited queries
- Advanced analytics & reporting
- Custom training & onboarding

## Database Schema Updates

### UserAccount Model
Added fields for enterprise accounts:
- `organization_name`: Company/Organization name
- `organization_size`: "small", "medium", "large", "enterprise"
- `is_company_account`: Boolean flag for company accounts

## Development Mode

### Subscription Bypass
For development and testing, subscription checks can be bypassed:

**Environment Variable:**
```bash
BYPASS_SUBSCRIPTION=1  # Set to "1" to bypass, "0" to enable checks
```

**Default:** Bypass is enabled (`BYPASS_SUBSCRIPTION=1`)

This allows you to:
- Test all features without subscribing
- Develop without payment integration
- Demo the system freely

**To Enable Subscription Checks (Production):**
```bash
BYPASS_SUBSCRIPTION=0
```

## API Updates

### Subscribe Endpoint
The subscribe endpoint now accepts enterprise-specific fields:
```json
{
  "plan_id": 3,
  "billing_period": "monthly",
  "organization_name": "Acme Corp",
  "organization_size": "large"
}
```

## Frontend Updates

### Pricing Page
- Enterprise plan highlighted with purple theme
- "FOR COMPANIES" badge
- Special "Contact Sales" button for enterprise
- Company-focused messaging

## Usage

### For Companies
1. Sign up for an account
2. Visit `/pricing` page
3. Select Enterprise plan
4. Provide company information during subscription
5. Get access to all enterprise features

### For Development
- Subscription checks are bypassed by default
- All features accessible without subscription
- Can test full functionality
- No payment required

## Next Steps

1. **Payment Integration**
   - Integrate Stripe/PayPal for enterprise payments
   - Handle enterprise invoicing

2. **Team Management**
   - Build team invitation system
   - Implement role-based permissions

3. **SSO Integration**
   - Integrate with SAML/OAuth providers
   - Support for Okta, Azure AD, etc.

4. **White-Labeling**
   - Custom branding interface
   - Domain configuration

5. **On-Premise Deployment**
   - Docker/Kubernetes deployment guides
   - Self-hosted installation scripts

