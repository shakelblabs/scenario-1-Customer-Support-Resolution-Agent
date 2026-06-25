import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { tools } from './tools';
import {
  handleGetCustomer,
  handleLookupOrder,
  handleProcessRefund,
  handleEscalateToHuman,
} from './toolHandlers';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a helpful customer support agent for HomeFixMart, an online home appliances store.

STRICT RULES — follow without exception:
1. ALWAYS call get_customer FIRST before any order lookup or refund. Never skip this step.
2. Never process a refund without a verified customer ID from get_customer.
3. If a customer has multiple orders matching their description, call lookup_order to retrieve all of them, then ASK the customer which specific order they mean before calling process_refund.
4. If process_refund returns requiresEscalation: true or hookMessage is present, immediately call escalate_to_human with a complete summary including the order ID, amount, and reason.
5. If a tool returns isRetryable: true in the response, retry that exact same tool call once before giving up.
6. If a refund is outside the return window, clearly explain the policy to the customer and do NOT attempt the refund.
7. Be friendly, concise, and professional.

TOOL USE ORDER FOR REFUNDS:
get_customer → lookup_order → (clarify if multiple matches) → process_refund → (escalate_to_human if needed)`;

type MessageParam = Anthropic.MessageParam;

export async function runAgentLoop(
  userMessage: string,
  conversationHistory: MessageParam[]
): Promise<{ response: string; history: MessageParam[] }> {
  const messages: MessageParam[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  let retriedTransient = false;

  while (true) {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    if (response.stop_reason === 'end_turn') {
      const textContent = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

      messages.push({ role: 'assistant', content: response.content });

      return { response: textContent, history: messages };
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        const toolName = block.name;
        const toolInput = block.input as Record<string, unknown>;

        console.log(`\n🔧 Tool called: ${toolName}`);
        console.log(`   Input: ${JSON.stringify(toolInput, null, 2)}`);

        let result: string;

        try {
          switch (toolName) {
            case 'get_customer':
              result = handleGetCustomer(toolInput as { name?: string; email?: string });
              break;
            case 'lookup_order':
              result = handleLookupOrder(
                toolInput as { customer_id: string; product_filter?: string; order_id?: string }
              );
              break;
            case 'process_refund':
              result = handleProcessRefund(
                toolInput as { customer_id: string; order_id: string; reason: string }
              );
              break;
            case 'escalate_to_human':
              result = handleEscalateToHuman(
                toolInput as {
                  customer_id: string;
                  core_problem: string;
                  order_id?: string;
                  amount?: number;
                  recommended_action: string;
                  conversation_summary: string;
                }
              );
              break;
            default:
              result = JSON.stringify({ error: true, message: `Unknown tool: ${toolName}` });
          }
        } catch (err: unknown) {
          result =
            typeof err === 'string'
              ? err
              : JSON.stringify({ error: true, message: String(err) });
        }

        // PostToolUse Hook — intercept transient errors and over-limit refunds
        try {
          const parsed = JSON.parse(result);

          if (parsed.error && parsed.isRetryable && !retriedTransient) {
            retriedTransient = true;
            console.log(`\n♻️  Transient error detected — retry signal injected`);
            result = JSON.stringify({
              ...parsed,
              retryInstruction: 'This is a transient error. Call the same tool again immediately.',
            });
          }

          if (toolName === 'process_refund' && parsed.requiresEscalation === true) {
            console.log(`\n⚡ PostToolUse Hook fired — refund over limit, escalation required`);
          }
        } catch {
          // result is not JSON, leave as-is
        }

        console.log(`   Result preview: ${result.substring(0, 300)}`);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }
  }
}
