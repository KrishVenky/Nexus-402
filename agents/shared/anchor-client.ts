import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection, SystemProgram } from "@solana/web3.js";
import { createConnection } from "./solana-client";
import { createLogger } from "./logger";
import {
  InitializeJobArgs,
  PostProofArgs,
  DisburseArgs,
  CancelJobArgs,
  JobAccount,
  AnalystProfileAccount,
} from "../../shared-types";

const log = createLogger("anchor-client");

// WHY: Anchor program is not yet deployed on devnet (build blocker).
// Setting MOCK_ANCHOR=true returns deterministic fake signatures so the
// full x402 agent flow can be demonstrated without a live program.
const MOCK_ANCHOR = process.env["MOCK_ANCHOR"] === "true";
const mockSig = (label: string): string =>
  `mock_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const MOCK_PROGRAM_ID = new PublicKey(
  process.env["PROGRAM_ID"] ?? "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"
);

export class NexusAnchorClient {
  private program: Program | null;
  private provider: AnchorProvider;

  constructor(wallet: Keypair, connection?: Connection) {
    const conn = connection ?? createConnection();
    const anchorWallet = new Wallet(wallet);
    this.provider = new AnchorProvider(conn, anchorWallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
    anchor.setProvider(this.provider);

    if (MOCK_ANCHOR) {
      // WHY: Skip IDL + Program init entirely — program.programId would be
      // undefined without a real deployed program, crashing PDA derivation.
      this.program = null;
      log.info("[MOCK] AnchorClient initialized", { programId: MOCK_PROGRAM_ID.toBase58() });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const idl = require("../../anchor/target/idl/nexus_escrow.json") as anchor.Idl;
    this.program = new Program(idl, this.provider);
    log.info("AnchorClient initialized", { programId: this.program!.programId.toBase58() });
  }

  // ─── PDA Derivation ───────────────────────────────────────────────────────

  deriveJobPda(initiator: PublicKey, jobId: Uint8Array): [PublicKey, number] {
    const programId = this.program?.programId ?? MOCK_PROGRAM_ID;
    return PublicKey.findProgramAddressSync(
      [Buffer.from("job"), initiator.toBuffer(), Buffer.from(jobId)],
      programId
    );
  }

  deriveAnalystProfilePda(owner: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("analyst"), owner.toBuffer()],
      this.program!.programId
    );
  }

  // ─── Fetch Accounts ───────────────────────────────────────────────────────

  async fetchJob(jobPda: PublicKey): Promise<JobAccount | null> {
    try {
      const raw = await (this.program!.account as any)["job"].fetch(jobPda);
      return raw as unknown as JobAccount;
    } catch {
      return null;
    }
  }

  async fetchAnalystProfile(profilePda: PublicKey): Promise<AnalystProfileAccount | null> {
    try {
      const raw = await (this.program!.account as any)["analystProfile"].fetch(profilePda);
      return raw as unknown as AnalystProfileAccount;
    } catch {
      return null;
    }
  }

  // ─── Instructions ─────────────────────────────────────────────────────────

  async initializeJob(args: InitializeJobArgs, workerPubkey: PublicKey): Promise<string> {
    if (MOCK_ANCHOR) {
      const sig = mockSig("initialize_job");
      log.info("[MOCK] initializeJob", { sig });
      return sig;
    }
    const initiator = (this.provider.wallet as Wallet).payer;
    const [jobPda] = this.deriveJobPda(initiator.publicKey, new Uint8Array(args.jobId));
    const [analystProfilePda] = this.deriveAnalystProfilePda(workerPubkey);

    const sig = await this.program!.methods
      .initializeJob(args.jobId, args.amountLamports, args.expirySeconds ?? null)
      .accounts({
        initiator: initiator.publicKey,
        worker: workerPubkey,
        analystProfile: analystProfilePda,
        job: jobPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([initiator])
      .rpc();

    log.info("initializeJob", { sig, jobPda: jobPda.toBase58() });
    return sig;
  }

  async postProof(args: PostProofArgs, initiatorPubkey: PublicKey): Promise<string> {
    if (MOCK_ANCHOR) {
      const sig = mockSig("post_proof");
      log.info("[MOCK] postProof", { sig });
      return sig;
    }
    const worker = (this.provider.wallet as Wallet).payer;
    const [jobPda] = this.deriveJobPda(initiatorPubkey, new Uint8Array(args.jobId));

    const sig = await this.program!.methods
      .postProof(args.jobId, args.proofHash)
      .accounts({ worker: worker.publicKey, job: jobPda })
      .signers([worker])
      .rpc();

    log.info("postProof", { sig, jobPda: jobPda.toBase58() });
    return sig;
  }

  async disburseFunds(args: DisburseArgs, workerPubkey: PublicKey): Promise<string> {
    if (MOCK_ANCHOR) {
      const sig = mockSig("disburse_funds");
      log.info("[MOCK] disburseFunds", { sig });
      return sig;
    }
    const initiator = (this.provider.wallet as Wallet).payer;
    const [jobPda] = this.deriveJobPda(initiator.publicKey, new Uint8Array(args.jobId));
    const [analystProfilePda] = this.deriveAnalystProfilePda(workerPubkey);

    const sig = await this.program!.methods
      .disburseFunds(args.jobId)
      .accounts({
        initiator: initiator.publicKey,
        worker: workerPubkey,
        job: jobPda,
        analystProfile: analystProfilePda,
        systemProgram: SystemProgram.programId,
      })
      .signers([initiator])
      .rpc();

    log.info("disburseFunds", { sig, jobPda: jobPda.toBase58() });
    return sig;
  }

  async cancelJob(args: CancelJobArgs): Promise<string> {
    if (MOCK_ANCHOR) {
      const sig = mockSig("cancel_job");
      log.warn("[MOCK] cancelJob", { sig });
      return sig;
    }
    const initiator = (this.provider.wallet as Wallet).payer;
    const [jobPda] = this.deriveJobPda(initiator.publicKey, new Uint8Array(args.jobId));

    const sig = await this.program!.methods
      .cancelJob(args.jobId)
      .accounts({
        initiator: initiator.publicKey,
        job: jobPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([initiator])
      .rpc();

    log.warn("cancelJob", { sig, jobPda: jobPda.toBase58() });
    return sig;
  }
}
