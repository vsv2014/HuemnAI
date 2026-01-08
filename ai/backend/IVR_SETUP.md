# IVR (Interactive Voice Response) Setup Guide

This guide will help you set up IVR functionality for your agents, allowing users to interact via phone calls.

## Prerequisites

1. **Twilio Account**: Sign up at [https://www.twilio.com](https://www.twilio.com)
2. **Twilio Phone Number**: Purchase a phone number from Twilio
3. **Public URL**: Your backend must be accessible via a public URL for webhooks (use ngrok for local development)

## Installation

### 1. Install Twilio SDK

The Twilio SDK is already added to `requirements.txt`. Install it:

```bash
cd ai/ai/backend
pip install -r requirements.txt
```

Or install directly:
```bash
pip install twilio
```

### 2. Configure Environment Variables

Add the following to your `.env` file or set as environment variables:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890  # Your Twilio phone number in E.164 format

# API Base URL (for webhooks)
# For local development with ngrok:
API_BASE_URL=https://your-ngrok-url.ngrok.io
# For production:
API_BASE_URL=https://your-domain.com
```

### 3. Get Twilio Credentials

1. Log in to [Twilio Console](https://console.twilio.com)
2. Go to **Account** → **API Keys & Tokens**
3. Copy your **Account SID** and **Auth Token**
4. Go to **Phone Numbers** → **Manage** → **Active Numbers**
5. Copy your Twilio phone number (format: +1234567890)

### 4. Set Up Webhook URL

1. In Twilio Console, go to **Phone Numbers** → **Manage** → **Active Numbers**
2. Click on your phone number
3. Under **Voice & Fax**, set:
   - **A CALL COMES IN**: `https://your-domain.com/api/ivr/call-handler`
   - **HTTP Method**: `POST`

**For Local Development:**
- Use [ngrok](https://ngrok.com) to expose your local server:
  ```bash
  ngrok http 8001
  ```
- Use the ngrok URL in your Twilio webhook: `https://your-ngrok-id.ngrok.io/api/ivr/call-handler`

### 5. Create an IVR Agent

1. Go to **Agents** → **Create Agent**
2. Select **Agent Type**: `IVR`
3. Build your flow using the visual flow builder:
   - Add a **START** node
   - Add **LLM** nodes for voice responses
   - Add **INTENT** nodes to detect user intent
   - Add **CONDITION** nodes for routing
   - Add **RESPONSE** nodes for voice output
   - Add **END** node to finish
4. Set the **Entry Node** (usually the START node)
5. Save and activate the agent

## Usage

### Making Outbound Calls

Use the API endpoint to make calls:

```bash
POST /api/ivr/make-call
{
  "to_number": "+1234567890",
  "agent_id": 1,
  "from_number": "+0987654321"  # Optional, defaults to TWILIO_PHONE_NUMBER
}
```

### Redirecting Chat to Call

From the test panel in the agent builder:
1. Click the **📞 Call** button
2. Enter phone number (E.164 format: +1234567890)
3. Select IVR agent
4. Click **Call Me**

The system will:
- Call the provided number
- Continue the conversation via voice
- Preserve chat context

### Handling Incoming Calls

Incoming calls are automatically handled by the `/api/ivr/call-handler` endpoint:
- Plays welcome message
- Gathers user input (DTMF or speech)
- Processes through agent flow
- Responds with voice output

## Features

- ✅ **Voice-to-Text**: Automatic transcription of speech input
- ✅ **Text-to-Voice**: Converts agent responses to speech
- ✅ **DTMF Support**: Keypad input (0-9, *, #)
- ✅ **Call Transfer**: Transfer to live agents
- ✅ **Context Preservation**: Chat history passed to voice calls
- ✅ **Call Status Tracking**: Monitor call status and duration

## Testing

### Test with Twilio Console

1. Go to **Phone Numbers** → **Test with TwiML**
2. Use the TwiML generator to test responses
3. Call your Twilio number to test the full flow

### Test Locally

1. Start ngrok: `ngrok http 8001`
2. Update Twilio webhook with ngrok URL
3. Call your Twilio number
4. The call will be routed to your local backend

## Troubleshooting

### Calls Not Connecting

- Check Twilio credentials are correct
- Verify webhook URL is accessible (use ngrok for local)
- Check Twilio console for error logs

### No Response from Agent

- Verify agent has an entry node set
- Check agent is active
- Review backend logs for errors
- Ensure flow has proper START → END path

### Webhook Errors

- Verify API_BASE_URL is set correctly
- Check webhook URL in Twilio console
- Ensure endpoint is accessible (not behind firewall)
- Review FastAPI logs for incoming requests

## API Endpoints

- `POST /api/ivr/call-handler` - Handle incoming Twilio calls (webhook)
- `POST /api/ivr/make-call` - Make outbound call
- `POST /api/ivr/redirect-to-call` - Redirect chat to call
- `POST /api/ivr/transfer-call` - Transfer call to another number
- `POST /api/ivr/hangup-call` - Hang up active call
- `GET /api/ivr/call-status/{call_sid}` - Get call status

## Next Steps

1. Configure Twilio credentials
2. Set up webhook URL
3. Create IVR agents
4. Test with phone calls
5. Integrate with your application

For more information, visit [Twilio Documentation](https://www.twilio.com/docs).

