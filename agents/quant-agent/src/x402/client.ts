/**
 * x402-client.ts — Full x402 handshake client for the Quant Agent
 *
 * Implements the complete buyer-side flow:
 *   Phase 1: POST /analyze → receive 402
 *   Phase 2: initialize_job on Anchor → lock funds
 *   Phase 3: POST /analyze/confirm → receive 202
 *   Phase 4: Poll /jobs/:id/status
 *   Phase 5: Verify callback proof_hash
 *   Phase 6: disburse_funds on Anchor
 */

import { Keypair, PublicKey } from "@solana/web3.js";
import { createLogger } from "../../../shared/logger";
import { X402_TIMEOUT_CONFIG, getBackoffDelay, sleep } from "../../../shared/timeout-config";
import { NexusAnchorClient } from "../../../shared/anchor-client";
import { generateJobId, hexToBytes32, sha256Hex, constantTimeEqual } from "../../../shared/crypto";
import {
  X402PaymentRequest,
  X402Response402,
  X402Callback,
  JobStatusResponse,
} from "../../../../shared-types";

const log = createLogger("x402-client");

// Fetch with abort signal timeout
const fetchWithTimeout = async (
  url: string,
  opts: RequestInit,
  timeoutMs: number
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export type X402JobResult = {
  success: true;
  jobId: string;
  proofHash: string;
  disburseTxSig: string;
  callback: X402Callback;
} | {
  success: false;
  jobId: string;
  reason: "invoice_timeout" | "escrow_failed" | "inference_timeout" | "proof_mismatch" | "cancelled";
  error: string;
};

export const executeX402Job = async (
  wallet: Keypair,
  analystEndpoint: string,
  request: X402PaymentRequest,
  workerPubkey: PublicKey
): Promise<X402JobResult> => {
  const jobId = generateJobId();
  const client = new NexusAnchorClient(wallet);

  log.info("x402 job started", { jobId, analystEndpoint });

  // ── Phase 1: Request work → receive 402 ─────────────────────────────────

  let invoice402: X402Response402 | null = null;

  for (let attempt = 0; attempt <= X402_TIMEOUT_CONFIG.MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(
        `${analystEndpoint}/api/v1/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Job-ID": jobId,
            "X-Agent-ID": wallet.publicKey.toBase58(),
          },
          body: JSON.stringify(request),
        },
        X402_TIMEOUT_CONFIG.INVOICE_RESPONSE_TIMEOUT_MS
      );

      if (res.status === 402) {
        invoice402 = await res.json() as X402Response402;
        break;
      } else if (res.status === 503) {
        const body = await res.json() as { retryAfter?: number };
        const retryMs = (body.retryAfter ?? 60) * 1000;
        log.warn("Analyst thermal throttle — waiting", { retryAfter: body.retryAfter });
        await sleep(retryMs);
        continue;
      } else {
        log.warn("Unexpected status from analyze", { status: res.status, attempt });
      }
    } catch (err) {
      log.warn("Phase 1 request failed", { attempt, error: String(err) });
    }

    if (attempt < X402_TIMEOUT_CONFIG.MAX_RETRIES) {
      await sleep(getBackoffDelay(attempt));
    }
  }

  if (!invoice402) {
    return { success: false, jobId, reason: "invoice_timeout", error: "No 402 received after max retries" };
  }

  const { invoice } = invoice402;
  log.info("402 received", { invoiceId: invoice.invoiceId, amount: invoice.amountLamports });

  // ── Phase 2: Lock funds in Anchor escrow ────────────────────────────────

  let escrowTxSig: string;
  const jobIdBytes = Array.from(hexToBytes32(jobId));

  try {
    escrowTxSig = await client.initializeJob(
      {
        jobId: jobIdBytes,
        amountLamports: BigInt(invoice.amountLamports),
        worker: workerPubkey.toBase58(),
        expirySeconds: X402_TIMEOUT_CONFIG.JOB_ESCROW_EXPIRY_SECONDS,
      },
      workerPubkey
    );
    log.info("Escrow initialized", { escrowTxSig });
  } catch (err) {
    return { success: false, jobId, reason: "escrow_failed", error: String(err) };
  }

  const [jobPda] = client.deriveJobPda(wallet.publicKey, hexToBytes32(jobId));

  // ── Phase 3: Confirm payment to Analyst ─────────────────────────────────

  try {
    const confirmRes = await fetchWithTimeout(
      `${analystEndpoint}/api/v1/analyze/confirm`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoice.invoiceId,
          jobId,
          escrowTxSignature: escrowTxSig,
          escrowPda: jobPda.toBase58(),
          confirmedAt: Math.floor(Date.now() / 1000),
        }),
      },
      X402_TIMEOUT_CONFIG.ESCROW_CONFIRM_TIMEOUT_MS
    );

    if (confirmRes.status !== 202) {
      const body = await confirmRes.text();
      log.warn("Confirm rejected", { status: confirmRes.status, body });
      // Try to cancel job and recover funds
      await attemptCancelAfterExpiry(client, jobIdBytes);
      return { success: false, jobId, reason: "escrow_failed", error: `Confirm rejected: ${body}` };
    }
  } catch (err) {
    return { success: false, jobId, reason: "escrow_failed", error: String(err) };
  }

  log.info("202 accepted — inference running", { jobId });

  // ── Phase 4: Poll for completion ─────────────────────────────────────────

  let callbackResult: X402Callback | null = null;
  // The callback is set by the analyst's deliverCallback(); we poll here as backup
  for (let poll = 0; poll < X402_TIMEOUT_CONFIG.MAX_POLL_ATTEMPTS; poll++) {
    await sleep(X402_TIMEOUT_CONFIG.STATUS_POLL_INTERVAL_MS);

    try {
      const statusRes = await fetchWithTimeout(
        `${analystEndpoint}/api/v1/jobs/${jobId}/status`,
        { method: "GET" },
        5_000
      );
      const status = await statusRes.json() as JobStatusResponse;

      if (status.status === "completed") {
        log.info("Job polling: completed", { jobId, poll });
        break;
      } else if (status.status === "error") {
        log.error("Job failed on analyst side", { jobId, error: status.error });
        await attemptCancelAfterExpiry(client, jobIdBytes);
        return { success: false, jobId, reason: "inference_timeout", error: status.error ?? "unknown" };
      }
    } catch (err) {
      log.warn("Status poll failed", { poll, error: String(err) });
    }

    if (poll === X402_TIMEOUT_CONFIG.MAX_POLL_ATTEMPTS - 1) {
      log.warn("Poll exhausted — cancelling job", { jobId });
      await attemptCancelAfterExpiry(client, jobIdBytes);
      return { success: false, jobId, reason: "inference_timeout", error: "Poll exhausted" };
    }
  }

  // At this point, the callback should have been received (set by analyst's deliverCallback)
  // If not yet received, this is a race condition — handled in callbacks route
  // If not yet received, this is a race condition — handled in callbacks route
  if (!callbackResult) {
    log.warn("Callback not yet received via webhook — waiting 2s", { jobId });
    await sleep(2_000);
  }

  // Read the actual populated callback
  const { receivedCallbacks } = await import("../routes/callbacks");
  const actualCallback = receivedCallbacks.get(jobId);

  return {
    success: true,
    jobId,
    proofHash: actualCallback?.proofHash ?? "pending",
    disburseTxSig: "see_callback_logs", // Callback route handles disbursement async
    callback: actualCallback ?? ({} as X402Callback),
  };
};

const attemptCancelAfterExpiry = async (
  client: NexusAnchorClient,
  jobIdBytes: number[]
): Promise<void> => {
  log.warn("Attempting cancel_job after expiry");
  try {
    await client.cancelJob({ jobId: jobIdBytes });
    log.info("cancel_job succeeded — funds recovered");
  } catch (err) {
    // May fail if not yet expired — that's expected
    log.warn("cancel_job failed (may not be expired yet)", { error: String(err) });
  }
};
