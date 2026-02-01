# Node Configuration & Agent Builder Guide

This guide provides a comprehensive overview of the Node-based Agent Builder, detailing each node type, its configuration options, features, and usage examples.

## Table of Contents
1. [Core Concepts](#core-concepts)
2. [Node Reference](#node-reference)
   - [Start Node](#start-node)
   - [Entity Node (Extraction & IVR)](#entity-node)
   - [Condition Node](#condition-node)
   - [Variable Node](#variable-node)
   - [LLM Node](#llm-node)
   - [Response Node](#response-node)
   - [API & Connector Nodes](#api--connector-nodes)
   - [Control Flow Nodes (Branch, Merge, Loop, Delay, End)](#control-flow-nodes)
3. [Advanced Features](#advanced-features)
   - [Variables & Context](#variables--context)
   - [IVR & Voice Settings](#ivr--voice-settings)
   - [Governance & Audit](#governance--audit)

---

## Core Concepts

The Agent Builder uses a **flow-based architecture** where logic is constructed by connecting nodes.
- **Context**: A shared memory space (JSON object) that persists throughout the conversation. Variables like `{{user.name}}` or `{{last_user_message}}` are accessed here.
- **Execution Flow**: Nodes are executed sequentially. Some nodes (Branch, Condition) split the flow, while others (Merge) converge it.

---

## Node Reference

### Start Node
**Purpose**: The entry point of the conversation.
- **Configuration**:
  - **Trigger Type**: `Message` (default), `Webhook` (API trigger), `Schedule` (Cron job).
  - **Welcome Message**: The first message sent to the user.
  - **Input Variables**: Define expected inputs (e.g., `user_id` from a webhook).
- **Example**:
  - *Trigger*: Message
  - *Welcome Message*: "Hi! I'm your Insurance Assistant. How can I help?"

### Entity Node
**Purpose**: Extract structured data (Dates, Names, Custom values) from user input with built-in IVR capabilities.

#### 1. Basic Configuration
- **Target Variable**: The context variable name to store the result (e.g., `user_city`).
- **Entity Type**:
  - System Types: `sys.date`, `sys.time`, `sys.number`, `sys.email`, `sys.phone`, `sys.person`, `sys.location`.
  - Custom: Uses LLM to extract values based on context.

#### 2. IVR Settings (Voice & Retries)
Designed for robust voice and chat interactions (Kore.ai style).
- **Prompts**:
  - **Initial Prompt**: Played/Sent when the node starts (e.g., "What city are you in?").
  - **Timeout Prompt**: Played if user doesn't respond within the timeout period.
  - **No Match Prompt**: Played if input doesn't match the entity type.
  - **Error Prompt**: Generic error message.
- **Settings**:
  - **Timeout**: Seconds to wait for input (default: 10s).
  - **Max Retries**: Number of attempts before failing (default: 3).
  - **Barge-in**: Allow user to interrupt the prompt (Voice only).
- **Instance Properties**:
  - **On Exceed Retries**: Choose behavior when retries are exhausted:
    - *End Dialog*: Terminate the flow.
    - *Transition*: Move to a specific "Failure" path (allows fallback logic).

#### 3. Advanced Controls
- **Entity Extraction Strategy**:
  - **Unused Text**: Analyze only text not yet consumed by previous nodes (Default).
  - **All Text**: Re-evaluate the entire user message history.
  - **Explicit Prompt**: Ignore the current input and force a new prompt (useful if the user's previous message was for a different intent).
- **Auto Correct**: Enable LLM-based spelling/grammar correction before extraction (e.g., "chicgo" -> "Chicago").
- **Intent Detection**:
  - **Accept as Entity**: Treat input as the value (Default).
  - **Prefer Intent**: If input looks like a command (e.g., "Cancel"), switch intent.
  - **Ask User**: If input looks like a command, ask confirmation ("Do you want to cancel?").

#### 4. Custom Tags
- Add metadata tags (`Message`, `User`, `Session`) to the node execution for analytics and reporting.

---

### Condition Node
**Purpose**: Route the flow based on logic rules.
- **Configuration**:
  - **Rules**: Create groups of conditions (AND/OR logic).
  - **Expression**: e.g., `user_age >= 18` AND `user_country == "US"`.
  - **Variables**: Access context via `{{variable}}`.
- **Output**: Defines a "True" path and a "False" path (or multiple branches).

### Variable Node
**Purpose**: Manipulate context variables without user input.
- **Operations**:
  - `Set`: Assign a value (String, Number, Boolean, JSON).
  - `Append`: Add to a list.
  - `Increment/Decrement`: Modify counters.
- **Example**:
  - *Operation*: Set
  - *Variable*: `retry_count`
  - *Value*: `0`

### LLM Node
**Purpose**: Generate dynamic responses or decisions using Large Language Models.
- **Configuration**:
  - **System Prompt**: Instructions for the AI (e.g., "You are a helpful assistant").
  - **User Prompt**: The input query (can use variables like `{{last_user_message}}`).
  - **Model**: Select `gpt-4o`, `gpt-3.5-turbo`, etc.
  - **Temperature**: Creativity control (0.0 = Deterministic, 1.0 = Creative).
  - **JSON Mode**: Force the output to be valid JSON.

### Response Node
**Purpose**: Send a message to the user.
- **Configuration**:
  - **Message Type**: Text, Image, Card, Carousel.
  - **Content**: The message body (supports variables).
  - **Quick Replies**: Buttons for common user responses.

### API & Connector Nodes
**Purpose**: Integrate with external systems.
- **API Node**: Make raw HTTP requests (GET/POST).
  - *Headers*, *Body*, *Auth*.
- **Connector Node**: Pre-built integrations (Salesforce, Zendesk, Jira).
  - *Action*: e.g., "Create Ticket", "Search Contact".

### Control Flow Nodes
- **Branch Node**: Split flow into multiple paths based on Intent (LLM-based routing).
- **Merge Node**: Recombine multiple paths into one. Handles context cleanup.
- **Loop Node**: Iterate over a list of items (e.g., process a list of orders).
- **Delay Node**: Pause execution for a set time.
- **End Node**: Explicitly terminate the conversation.

---

## Advanced Features

### Variables & Context
- **Syntax**: `{{variable_name}}`
- **Scope**: Variables are global to the session.
- **Nested Access**: `{{user.address.city}}` is supported.

### IVR & Voice Settings
Designed to support voice gateways (Twilio, VAPI).
- **Barge-in**: Essential for natural voice interaction.
- **Grammar**: Define expected speech patterns (SRGS/XML) for precise recognition.

### Governance & Audit
- **Audit Logs**: Every change to the agent is logged (Who, What, When).
- **PII Redaction**: Sensitive data (emails, phones) is automatically redacted in logs.
- **RBAC**: Role-based access control restricts who can edit or publish agents.

---

## Example: Insurance Policy Lookup

1. **Start Node**: Trigger on "Message".
2. **Entity Node (Policy Number)**:
   - *Prompt*: "Please say or type your 10-digit policy number."
   - *Type*: `sys.number` or `custom` (regex: `^\d{10}$`).
   - *Retries*: 3.
3. **API Node**:
   - *URL*: `https://api.insurance.com/v1/policies/{{policy_number}}`
   - *Method*: GET.
4. **Condition Node**:
   - *If*: `api_response.status == "active"` -> **Go to Path A**.
   - *Else*: -> **Go to Path B**.
5. **Path A (Response)**: "Your policy is active. Coverage details: {{api_response.coverage}}."
6. **Path B (Response)**: "Sorry, that policy is inactive or not found."

