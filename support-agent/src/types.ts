export interface Customer {
  id: string;
  name: string;
  email: string;
  verified: boolean;
}

export interface EmbeddedRefundPolicy {
  windowDays: number;
  maxAutoRefund: number;
  policyVersion: string;
  effectiveDate: string;
}

export interface Order {
  orderId: string;
  customerId: string;
  productName: string;
  brand: string;
  amount: number;
  purchaseDate: string;
  status: 'delivered' | 'processing' | 'cancelled';
  refundPolicy: EmbeddedRefundPolicy;
}

export interface AgentState {
  verifiedCustomerId: string | null;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface StructuredError {
  category: 'transient' | 'validation' | 'permission';
  isRetryable: boolean;
  message: string;
  details?: string;
}

export interface EscalationSummary {
  customerId: string;
  customerName: string;
  coreProblem: string;
  orderId?: string;
  amount?: number;
  recommendedAction: string;
  conversationSummary: string;
}
