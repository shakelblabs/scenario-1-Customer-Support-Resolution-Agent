import 'dotenv/config';
import * as readline from 'readline';
import { runAgentLoop } from './agent';
import Anthropic from '@anthropic-ai/sdk';

type MessageParam = Anthropic.MessageParam;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function runScenario(
  label: string,
  turns: string[]
): Promise<void> {
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`${label}`);
  console.log('═'.repeat(64));

  let history: MessageParam[] = [];

  for (const userMsg of turns) {
    console.log(`\n👤 Customer: ${userMsg}`);
    const result = await runAgentLoop(userMsg, history);
    history = result.history;
    console.log(`\n🤖 Agent: ${result.response}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       HomeFixMart Customer Support Agent — Demo              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // SCENARIO 1: Asha Patel — 3 water heaters, disambiguation, then refund
  // ORD-001-WH1 (HeatPro $449, 30-day window, $500 limit) purchased 2024-03-15 — expired window
  // ORD-001-WH2 (WarmFlow $529, 45-day window, $500 limit) purchased 2026-06-10 — over limit → escalate
  // ORD-001-WH3 (AquaTherm $599, 60-day window, $750 limit) purchased 2026-05-20 — within window, over limit → escalate
  // We pick ORD-001-WH2 for the follow-up to demonstrate over-limit escalation
  await runScenario('DEMO SCENARIO 1 — Multi-purchase disambiguation + over-limit escalation', [
    "Hi, it's Asha Patel. My water heater is faulty, I want a refund.",
    "It's the WarmFlow one I bought in June 2026, order ORD-001-WH2.",
  ]);

  // SCENARIO 2: Same structure as required prompt 2 — water heater, 3 orders found
  // Using Marcus Chen (CUST-002) who has ORD-002-022 WarmFlow Water Heater 40gal $834
  // That order: 30-day window, $500 maxAutoRefund, purchased 2024-07-21 — expired window
  await runScenario('DEMO SCENARIO 2 — "I bought a water heater" (required prompt)', [
    "I bought a water heater from you, it's leaking, refund please.",
    "My name is Marcus Chen.",
    "It's order ORD-002-022.",
  ]);

  // SCENARIO 3: David Mueller — laptop $1153, maxAutoRefund $750 → auto-escalation
 await runScenario('DEMO SCENARIO 3 — Over-limit laptop refund auto-escalation (required prompt)', [
  "Hi I'm David Mueller, refund my laptop please.",
  "It's faulty, won't turn on. Order ORD-003-LAP1.",
]);

await runScenario('DEMO SCENARIO 4 — Identity gate block', [
  "Please refund order ORD-003-LAP1, my customer ID is CUST-999.",
]);

  console.log(`\n${'═'.repeat(64)}`);
  console.log('All demo scenarios complete. Entering interactive mode.');
  console.log('Type your message. Commands: "reset" = new conversation, "exit" = quit.');
  console.log('═'.repeat(64));

  let interactiveHistory: MessageParam[] = [];

  while (true) {
    const input = await ask('\n👤 You: ');

    if (input.toLowerCase() === 'exit') {
      console.log('Goodbye!');
      rl.close();
      break;
    }

    if (input.toLowerCase() === 'reset') {
      interactiveHistory = [];
      console.log('Conversation reset.');
      continue;
    }

    if (!input.trim()) continue;

    try {
      const result = await runAgentLoop(input, interactiveHistory);
      interactiveHistory = result.history;
      console.log(`\n🤖 Agent: ${result.response}`);
    } catch (err) {
      console.error('Error:', err);
    }
  }
}

main().catch(console.error);
