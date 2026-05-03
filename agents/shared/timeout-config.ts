/**
 * timeout-config.ts — Centralized timeout and retry constants
 *
 * WHY these values:
 * - Pi 5 + Hailo-8 inference p95 = 5–15s; 60s gives thermal headroom
 * - Escrow expiry 300s = safe window for even worst-case Pi 5 thermal throttle
 * - 3 retries with 2x backoff = max 7s of retries (1s + 2s + 4s) before abort
 */

export const X402_TIMEOUT_CONFIG = {
  // Per-phase HTTP timeouts (ms)
  INVOICE_RESPONSE_TIMEOUT_MS: 5_000,
  ESCROW_CONFIRM_TIMEOUT_MS: 30_000,
  INFERENCE_TIMEOUT_MS: 60_000,
  CALLBACK_DELIVERY_TIMEOUT_MS: 5_000,
  PROOF_SUBMISSION_TIMEOUT_MS: 30_000,

  // Retry policy
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY_MS: 1_000,
  RETRY_BACKOFF_MULTIPLIER: 2.0,
  MAX_RETRY_DELAY_MS: 10_000,

  // Escrow on-chain expiry (seconds) — must match or exceed inference timeout
  JOB_ESCROW_EXPIRY_SECONDS: 300,

  // Status polling
  STATUS_POLL_INTERVAL_MS: 2_000,
  MAX_POLL_ATTEMPTS: 25,        // 25 × 2s = 50s total polling window

  // Pi 5 thermal guards (°C)
  TEMP_WARN_C: 70,
  TEMP_HOT_C: 80,
  TEMP_CRITICAL_C: 85,
} as const;

export type TimeoutConfig = typeof X402_TIMEOUT_CONFIG;

/**
 * Compute exponential backoff delay with jitter for a given retry attempt.
 * Jitter prevents thundering herd when multiple agents retry simultaneously.
 */
export const getBackoffDelay = (attempt: number): number => {
  const base = X402_TIMEOUT_CONFIG.INITIAL_RETRY_DELAY_MS;
  const multiplier = X402_TIMEOUT_CONFIG.RETRY_BACKOFF_MULTIPLIER;
  const max = X402_TIMEOUT_CONFIG.MAX_RETRY_DELAY_MS;
  const exponential = base * Math.pow(multiplier, attempt);
  const jitter = Math.random() * 200; // ±200ms jitter
  return Math.min(exponential + jitter, max);
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
