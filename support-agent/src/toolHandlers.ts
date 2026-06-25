import { customers, orders, verifiedCustomers } from './database';
import { createError, formatErrorForAgent, maybeSimulateTransientError } from './errors';
import { EscalationSummary } from './types';

function requireVerifiedCustomer(customerId: string): void {
  if (!customerId) {
    throw formatErrorForAgent(
      createError(
        'permission',
        'Identity verification required. Call get_customer first before accessing orders or processing refunds.'
      )
    );
  }
  if (!verifiedCustomers.has(customerId)) {
    throw formatErrorForAgent(
      createError(
        'permission',
        'Customer not verified. The customer ID provided has not been verified in this session. Call get_customer first.'
      )
    );
  }
}

export function handleGetCustomer(input: { name?: string; email?: string }): string {
  const { name, email } = input;

  if (!name && !email) {
    return formatErrorForAgent(
      createError('validation', 'Please provide either a name or email to look up the customer.')
    );
  }

  const customer = customers.find(
    (c) =>
      (name && c.name.toLowerCase().includes(name.toLowerCase())) ||
      (email && c.email.toLowerCase() === email.toLowerCase())
  );

  if (!customer) {
    return formatErrorForAgent(
      createError(
        'validation',
        `No customer found with the provided details: "${name || email}". Please ask the customer to confirm their name or email.`
      )
    );
  }

  const verifiedCustomer = { ...customer, verified: true };
  verifiedCustomers.set(customer.id, verifiedCustomer);

  return JSON.stringify({
    success: true,
    customerId: customer.id,
    name: customer.name,
    email: customer.email,
    verified: true,
    message: `Customer verified: ${customer.name} (ID: ${customer.id})`,
  });
}

export function handleLookupOrder(input: {
  customer_id: string;
  product_filter?: string;
  order_id?: string;
}): string {
  requireVerifiedCustomer(input.customer_id);

  const transientError = maybeSimulateTransientError('lookup_order');
  if (transientError) {
    return formatErrorForAgent(transientError);
  }

  let customerOrders = orders.filter((o) => o.customerId === input.customer_id);

  if (input.order_id) {
    customerOrders = customerOrders.filter((o) => o.orderId === input.order_id);
  } else if (input.product_filter) {
    customerOrders = customerOrders.filter(
      (o) =>
        o.productName.toLowerCase().includes(input.product_filter!.toLowerCase()) ||
        o.brand.toLowerCase().includes(input.product_filter!.toLowerCase())
    );
  }

  if (customerOrders.length === 0) {
    return JSON.stringify({
      success: true,
      orders: [],
      message: 'No matching orders found for this customer.',
    });
  }

  return JSON.stringify({
    success: true,
    count: customerOrders.length,
    orders: customerOrders.map((o) => ({
      orderId: o.orderId,
      productName: o.productName,
      brand: o.brand,
      amount: o.amount,
      purchaseDate: o.purchaseDate,
      status: o.status,
      refundPolicy: o.refundPolicy,
    })),
    message:
      customerOrders.length > 1
        ? `Found ${customerOrders.length} matching orders. Ask the customer to confirm which specific order they want to return.`
        : 'Found 1 order.',
  });
}

export function handleProcessRefund(input: {
  customer_id: string;
  order_id: string;
  reason: string;
}): string {
  requireVerifiedCustomer(input.customer_id);

  const order = orders.find(
    (o) => o.orderId === input.order_id && o.customerId === input.customer_id
  );

  if (!order) {
    return formatErrorForAgent(
      createError('validation', `Order ${input.order_id} not found for this customer.`)
    );
  }

  const policy = order.refundPolicy;

  if (!policy) {
    return formatErrorForAgent(
      createError('validation', `No refund policy found for order ${input.order_id}.`)
    );
  }

  const purchaseDate = new Date(order.purchaseDate);
  const today = new Date();
  const daysSincePurchase = Math.floor(
    (today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSincePurchase > policy.windowDays) {
    return JSON.stringify({
      success: false,
      eligible: false,
      reason: 'outside_window',
      message: `Refund window expired. The policy for ${order.brand} (${order.productName}) allows ${policy.windowDays} days, but this order was purchased ${daysSincePurchase} days ago on ${order.purchaseDate}. This order is NOT eligible for a refund under the current policy.`,
      orderId: order.orderId,
      amount: order.amount,
      policyVersion: policy.policyVersion,
    });
  }

  if (order.amount > policy.maxAutoRefund) {
    return JSON.stringify({
      success: false,
      eligible: true,
      requiresEscalation: true,
      reason: 'over_limit',
      message: `Refund of $${order.amount} exceeds the auto-approve limit of $${policy.maxAutoRefund} for ${order.brand}. This requires human approval.`,
      orderId: order.orderId,
      amount: order.amount,
      maxAutoRefund: policy.maxAutoRefund,
      policyVersion: policy.policyVersion,
      hookMessage:
        'HOOK: This refund exceeds auto-approve limit. You MUST call escalate_to_human immediately with a complete summary.',
    });
  }

  return JSON.stringify({
    success: true,
    eligible: true,
    requiresEscalation: false,
    refundApproved: true,
    message: `Refund of $${order.amount} approved for order ${order.orderId} (${order.productName} by ${order.brand}). Reason: ${input.reason}. The refund will be credited within 3-5 business days.`,
    orderId: order.orderId,
    amount: order.amount,
    brand: order.brand,
    daysSincePurchase,
    windowDays: policy.windowDays,
    policyVersion: policy.policyVersion,
  });
}

export function handleEscalateToHuman(input: {
  customer_id: string;
  core_problem: string;
  order_id?: string;
  amount?: number;
  recommended_action: string;
  conversation_summary: string;
}): string {
  const customer =
    verifiedCustomers.get(input.customer_id) ||
    customers.find((c) => c.id === input.customer_id);

  const summary: EscalationSummary = {
    customerId: input.customer_id,
    customerName: customer?.name || 'Unknown',
    coreProblem: input.core_problem,
    orderId: input.order_id,
    amount: input.amount,
    recommendedAction: input.recommended_action,
    conversationSummary: input.conversation_summary,
  };

  const line = '═'.repeat(62);

  const escalationOutput = [
    line,
    '🚨  HUMAN ESCALATION REQUIRED',
    line,
    `Customer ID   : ${summary.customerId}`,
    `Customer Name : ${summary.customerName}`,
    `Order ID      : ${summary.orderId || 'N/A'}`,
    `Amount        : ${summary.amount ? '$' + summary.amount : 'N/A'}`,
    line,
    'CORE PROBLEM:',
    summary.coreProblem,
    line,
    'RECOMMENDED ACTION:',
    summary.recommendedAction,
    line,
    'CONVERSATION SUMMARY:',
    summary.conversationSummary,
    line,
  ].join('\n');

  return JSON.stringify({
    success: true,
    escalated: true,
    summary: escalationOutput,
    data: summary,
    message: 'Case successfully escalated to human support team.',
  });
}
