import { StructuredError } from './types';

export function createError(
  category: StructuredError['category'],
  message: string,
  details?: string
): StructuredError {
  return {
    category,
    isRetryable: category === 'transient',
    message,
    details,
  };
}

export function formatErrorForAgent(error: StructuredError): string {
  return JSON.stringify({
    error: true,
    category: error.category,
    isRetryable: error.isRetryable,
    message: error.message,
    details: error.details || null,
  });
}

const transientErrorTracker: Map<string, boolean> = new Map();

export function maybeSimulateTransientError(toolName: string): StructuredError | null {
  if (toolName === 'lookup_order' && !transientErrorTracker.has(toolName)) {
    transientErrorTracker.set(toolName, true);
    return createError(
      'transient',
      'Database connection timeout. Please retry.',
      'Simulated transient error for demo purposes'
    );
  }
  return null;
}
