import express, { Request, Response, NextFunction } from "express";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { createLogger } from "../shared/logger";
import { strategyRouter } from "./routes/strategy";
import { callbackRouter } from "./routes/callbacks";

const log = createLogger("quant-agent");

async function main(): Promise<void> {
  const privateKeyEnv = process.env["QUANT_AGENT_WALLET_PRIVATE_KEY"];
  let wallet: Keypair;
  if (privateKeyEnv) {
    wallet = Keypair.fromSecretKey(bs58.decode(privateKeyEnv));
  } else {
    wallet = Keypair.generate();
    log.warn("No wallet key — using ephemeral keypair (dev only)", {
      pubkey: wallet.publicKey.toBase58(),
    });
  }

  log.info("Quant Agent wallet", { pubkey: wallet.publicKey.toBase58() });

  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Attach wallet context
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { wallet: Keypair }).wallet = wallet;
    next();
  });

  app.use("/api/v1/strategy", strategyRouter);
  app.use("/api/v1/callbacks", callbackRouter);

  app.get("/api/v1/health", (_req: Request, res: Response) => {
    res.json({ ok: true, pubkey: wallet.publicKey.toBase58() });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    log.error("Unhandled error", { error: err.message });
    res.status(500).json({ error: "Internal server error" });
  });

  const port = parseInt(process.env["QUANT_AGENT_PORT"] ?? "3001", 10);
  app.listen(port, () => log.info(`Quant Agent running`, { port }));
}

main().catch((err: Error) => {
  console.error("Fatal:", err);
  process.exit(1);
});
