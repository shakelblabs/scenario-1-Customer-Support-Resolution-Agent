import Anthropic from '@anthropic-ai/sdk';

export const tools: Anthropic.Tool[] = [
  {
    name: 'get_customer',
    description: `Look up and verify a customer identity by their name or email address.
ALWAYS call this tool FIRST before any order lookup or refund operation.
Returns customer ID and verification status.
Do NOT call lookup_order or process_refund until this tool confirms a verified customer ID.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: "The customer's full name (optional if email provided)",
        },
        email: {
          type: 'string',
          description: "The customer's email address (optional if name provided)",
        },
      },
      required: [],
    },
  },
  {
    name: 'lookup_order',
    description: `Look up orders for a verified customer.
Requires a verified customer ID obtained from get_customer first.
Can filter by product name or category to find specific orders.
When a customer has multiple orders matching the same product type, returns ALL of them so the agent can ask the customer to clarify which one they mean.
Do NOT call this without a verified customer ID.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_id: {
          type: 'string',
          description: 'The verified customer ID from get_customer',
        },
        product_filter: {
          type: 'string',
          description:
            'Optional keyword to filter orders by product name e.g. water heater, blender',
        },
        order_id: {
          type: 'string',
          description: 'Optional specific order ID to look up a single order',
        },
      },
      required: ['customer_id'],
    },
  },
  {
    name: 'process_refund',
    description: `Process a refund for a specific order after verifying customer identity and checking refund eligibility.
Requires verified customer ID and specific order ID.
Automatically checks refund policy window and amount limits.
Refunds above the auto-approve limit will be flagged for escalation to a human instead of being processed automatically.
Do NOT call this without a verified customer ID.
Do NOT guess the order ID — confirm it with the customer first if there are multiple orders.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_id: {
          type: 'string',
          description: 'The verified customer ID',
        },
        order_id: {
          type: 'string',
          description: 'The specific order ID to refund',
        },
        reason: {
          type: 'string',
          description: 'The reason for the refund e.g. faulty product, wrong item',
        },
      },
      required: ['customer_id', 'order_id', 'reason'],
    },
  },
  {
    name: 'escalate_to_human',
    description: `Escalate the issue to a human support agent when:
- The refund amount exceeds the auto-approve limit
- The issue is complex or ambiguous and cannot be resolved automatically
- The customer is frustrated or the situation requires judgment beyond automated handling
- The refund policy window has expired and customer disputes it
Creates a clean handoff summary for the human agent.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_id: {
          type: 'string',
          description: 'The customer ID',
        },
        core_problem: {
          type: 'string',
          description: "Brief description of the customer's issue",
        },
        order_id: {
          type: 'string',
          description: 'The relevant order ID if applicable',
        },
        amount: {
          type: 'number',
          description: 'The refund amount being requested if applicable',
        },
        recommended_action: {
          type: 'string',
          description:
            'What the human agent should do e.g. approve refund, verify purchase details, contact customer',
        },
        conversation_summary: {
          type: 'string',
          description: 'A concise summary of the entire conversation so far',
        },
      },
      required: ['customer_id', 'core_problem', 'recommended_action', 'conversation_summary'],
    },
  },
];
