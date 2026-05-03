import express, { Request, Response, NextFunction } from "express";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { createLogger } from "../../shared/logger";
import { runHardwareCheck } from "../../hardware_check";
import { analyzeRouter } from "./routes/analyze";
import { statusRouter } from "./routes/status";
import { healthRouter } from "./routes/health";
import { InferenceBackend } from "../../hardware_check";

const log = createLogger("analyst-agent");

export type AgentContext = {
  wallet: Keypair;
  inferenceBackend: InferenceBackend;
  startedAt: number;
};

async function main(): Promise<void> {
  // ── Hardware detection ────────────────────────────────────────────────────
  const hardware = await runHardwareCheck();
  log.info("Hardware check complete", {
    backend: hardware.recommendedBackend,
    npu: hardware.hailo8.available,
    cpuTemp: hardware.cpu.temperatureCelsius,
  });

  if (hardware.errors.length > 0) {
    log.error("Critical hardware errors — cannot start", { errors: hardware.errors });
    process.exit(1);
  }

  hardware.warnings.forEach((w: string) => log.warn(w));

  // ── Wallet setup ─────────────────────────────────────────────────────────
  const privateKeyEnv = process.env["ANALYST_AGENT_WALLET_PRIVATE_KEY"];
  let wallet: Keypair;
  if (privateKeyEnv) {
    wallet = Keypair.fromSecretKey(bs58.decode(privateKeyEnv));
  } else {
    wallet = Keypair.generate();
    log.warn("No wallet key provided — using ephemeral keypair (dev only)", {
      pubkey: wallet.publicKey.toBase58(),
    });
  }

  log.info("Analyst Agent wallet", { pubkey: wallet.publicKey.toBase58() });

  const ctx: AgentContext = {
    wallet,
    inferenceBackend: hardware.recommendedBackend,
    startedAt: Date.now(),
  };

  // ── Express server ────────────────────────────────────────────────────────
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Attach agent context to all routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { agentCtx: AgentContext }).agentCtx = ctx;
    next();
  });

  app.use("/api/v1", analyzeRouter);
  app.use("/api/v1/jobs", statusRouter);
  app.use("/api/v1", healthRouter(ctx));

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    log.error("Unhandled error", { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Internal server error" });
  });

  const port = parseInt(process.env["ANALYST_AGENT_PORT"] ?? "3002", 10);
  app.listen(port, () => {
    log.info(`Analyst Agent running`, { port, backend: hardware.recommendedBackend });
  });
}

main().catch((err: Error) => {
  console.error("Fatal:", err);
  process.exit(1);
});
