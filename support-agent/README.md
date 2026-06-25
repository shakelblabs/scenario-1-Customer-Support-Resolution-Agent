Project made for assessment for BusinessLabs.org
My id is 2026-2407

# HomeFixMart Customer Support Resolution Agent

A Node.js/TypeScript agentic customer support system built on the Anthropic Claude API.

## Setup

1. Install dependencies:
```
npm install
```

2. Configure your API key in `.env`:
```
ANTHROPIC_API_KEY=your_actual_key_here
```

3. Run the demo:
```
npx ts-node src/index.ts
```

## Architecture

```
src/
├── index.ts          # Entry point — runs demo scenarios then interactive mode
├── agent.ts          # Agentic loop with PostToolUse hook logic
├── tools.ts          # Anthropic tool definitions
├── toolHandlers.ts   # Tool implementations (get_customer, lookup_order, process_refund, escalate_to_human)
├── database.ts       # In-memory data store loaded from JSON
├── errors.ts         # Structured error factory + transient error simulation
├── types.ts          # TypeScript interfaces
└── data/
    └── support-tickets.json   # Seed data (customers + orders)
```

## Features

- **Identity gate**: `get_customer` must be called first — all other tools enforce this with a `permission` error
- **Multi-purchase disambiguation**: when a customer has multiple matching orders, the agent asks to clarify before processing
- **Structured errors**: every error returns `{ error, category, isRetryable, message }` — the agent retries transient errors automatically
- **PostToolUse hook**: intercepts `process_refund` results and injects a retry signal for transient errors; logs an alert when escalation is required
- **Auto-escalation**: refunds over the per-brand `maxAutoRefund` threshold are flagged and routed to `escalate_to_human`
- **Clean escalation summaries**: the escalation tool produces a formatted handoff card for the human agent

## Demo Scenarios

| Scenario | Customer | Outcome |
|---|---|---|
| 1 | Asha Patel — 3 water heaters | Disambiguation → over-limit escalation (WarmFlow $529 > $500 limit) |
| 2 | Marcus Chen — water heater | Expired 30-day window → policy explanation |
| 3 | David Mueller — laptop | Over-limit escalation ($1153 > $750 limit) |

## Tool Flow

```
get_customer → lookup_order → (clarify if multiple) → process_refund → escalate_to_human (if needed)
```
