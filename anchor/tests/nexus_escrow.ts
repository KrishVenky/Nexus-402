import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { NexusEscrow } from "../target/types/nexus_escrow";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { assert } from "chai";
import * as crypto from "crypto";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> =>
  new Promise((res) => setTimeout(res, ms));

const randomJobId = (): Uint8Array =>
  crypto.randomBytes(32);

const sha256 = (data: string): Buffer =>
  crypto.createHash("sha256").update(data).digest();

const deriveJobPda = (
  program: Program<NexusEscrow>,
  initiator: PublicKey,
  jobId: Uint8Array
): [PublicKey, number] =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("job"), initiator.toBuffer(), Buffer.from(jobId)],
    program.programId
  );

const deriveAnalystPda = (
  program: Program<NexusEscrow>,
  owner: PublicKey
): [PublicKey, number] =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("analyst"), owner.toBuffer()],
    program.programId
  );

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("nexus_escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.NexusEscrow as Program<NexusEscrow>;

  let quant: Keypair;   // Buyer (initiator)
  let analyst: Keypair; // Worker
  let [analystProfilePda] = [PublicKey.default, 0];

  const MIN_STAKE = new BN(10_000_000); // 0.01 SOL
  const JOB_AMOUNT = new BN(500_000);   // 0.0005 SOL

  before(async () => {
    quant = Keypair.generate();
    analyst = Keypair.generate();

    // Fund both wallets from the provider
    for (const kp of [quant, analyst]) {
      const sig = await provider.connection.requestAirdrop(
        kp.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig, "confirmed");
    }

    [analystProfilePda] = deriveAnalystPda(program, analyst.publicKey);
  });

  // ─── Analyst Profile ──────────────────────────────────────────────────────

  describe("initialize_analyst_profile", () => {
    it("creates a profile with valid stake", async () => {
      await program.methods
        .initializeAnalystProfile(MIN_STAKE)
        .accounts({
          owner: analyst.publicKey,
          analystProfile: analystProfilePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([analyst])
        .rpc();

      const profile = await program.account.analystProfile.fetch(analystProfilePda);
      assert.equal(profile.owner.toBase58(), analyst.publicKey.toBase58());
      assert.equal(profile.stakeAmount.toNumber(), MIN_STAKE.toNumber());
      assert.equal(profile.jobsCompleted.toNumber(), 0);
      assert.equal(profile.reputationScore.toNumber(), 0);
    });

    it("rejects insufficient stake", async () => {
      const badAnalyst = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        badAnalyst.publicKey, LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig, "confirmed");
      const [profilePda] = deriveAnalystPda(program, badAnalyst.publicKey);

      try {
        await program.methods
          .initializeAnalystProfile(new BN(1_000)) // way below 0.01 SOL
          .accounts({
            owner: badAnalyst.publicKey,
            analystProfile: profilePda,
            systemProgram: SystemProgram.programId,
          })
          .signers([badAnalyst])
          .rpc();
        assert.fail("Should have rejected insufficient stake");
      } catch (err: any) {
        assert.include(err.message, "InsufficientStake");
      }
    });

    it("PDA derived as [analyst, owner_pubkey]", async () => {
      const [expected] = PublicKey.findProgramAddressSync(
        [Buffer.from("analyst"), analyst.publicKey.toBuffer()],
        program.programId
      );
      assert.equal(expected.toBase58(), analystProfilePda.toBase58());
    });

    it("is idempotent — second call fails (account already exists)", async () => {
      try {
        await program.methods
          .initializeAnalystProfile(MIN_STAKE)
          .accounts({
            owner: analyst.publicKey,
            analystProfile: analystProfilePda,
            systemProgram: SystemProgram.programId,
          })
          .signers([analyst])
          .rpc();
        assert.fail("Should have rejected duplicate profile");
      } catch (err: any) {
        // Account already exists at this PDA
        assert.isOk(err);
      }
    });
  });

  // ─── Initialize Job ───────────────────────────────────────────────────────

  describe("initialize_job", () => {
    let jobId: Uint8Array;
    let jobPda: PublicKey;

    beforeEach(() => {
      jobId = randomJobId();
      [jobPda] = deriveJobPda(program, quant.publicKey, jobId);
    });

    it("creates job PDA with correct state", async () => {
      await program.methods
        .initializeJob(
          Array.from(jobId),
          JOB_AMOUNT,
          null // default 5-min expiry
        )
        .accounts({
          initiator: quant.publicKey,
          worker: analyst.publicKey,
          analystProfile: analystProfilePda,
          job: jobPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([quant])
        .rpc();

      const job = await program.account.job.fetch(jobPda);
      assert.equal(job.initiator.toBase58(), quant.publicKey.toBase58());
      assert.equal(job.worker.toBase58(), analyst.publicKey.toBase58());
      assert.equal(job.amountLamports.toNumber(), JOB_AMOUNT.toNumber());
      assert.deepEqual(job.status, { initialized: {} });
      assert.deepEqual(job.proofHash, new Array(32).fill(0));
    });

    it("PDA derived as [job, initiator, job_id]", async () => {
      const [expected] = PublicKey.findProgramAddressSync(
        [Buffer.from("job"), quant.publicKey.toBuffer(), Buffer.from(jobId)],
        program.programId
      );
      assert.equal(expected.toBase58(), jobPda.toBase58());
    });

    it("two jobs with same initiator + different job_id produce distinct PDAs", async () => {
      const id1 = randomJobId();
      const id2 = randomJobId();
      const [pda1] = deriveJobPda(program, quant.publicKey, id1);
      const [pda2] = deriveJobPda(program, quant.publicKey, id2);
      assert.notEqual(pda1.toBase58(), pda2.toBase58());
    });

    it("two jobs with same job_id but different initiators produce distinct PDAs", async () => {
      const id = randomJobId();
      const other = Keypair.generate();
      const [pda1] = deriveJobPda(program, quant.publicKey, id);
      const [pda2] = deriveJobPda(program, other.publicKey, id);
      assert.notEqual(pda1.toBase58(), pda2.toBase58());
    });

    it("rejects amount below minimum", async () => {
      try {
        await program.methods
          .initializeJob(Array.from(jobId), new BN(100), null)
          .accounts({
            initiator: quant.publicKey,
            worker: analyst.publicKey,
            analystProfile: analystProfilePda,
            job: jobPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([quant])
          .rpc();
        assert.fail("Should have rejected low amount");
      } catch (err: any) {
        assert.include(err.message, "JobAmountTooLow");
      }
    });
  });

  // ─── Full Lifecycle: initialize → post_proof → disburse ───────────────────

  describe("full job lifecycle", () => {
    let jobId: Uint8Array;
    let jobPda: PublicKey;
    const resultPayload = JSON.stringify({ BTC: "positive", SOL: "positive" });
    const proofHash = Array.from(sha256(resultPayload));

    before(async () => {
      jobId = randomJobId();
      [jobPda] = deriveJobPda(program, quant.publicKey, jobId);

      await program.methods
        .initializeJob(Array.from(jobId), JOB_AMOUNT, null)
        .accounts({
          initiator: quant.publicKey,
          worker: analyst.publicKey,
          analystProfile: analystProfilePda,
          job: jobPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([quant])
        .rpc();
    });

    it("post_proof: only designated worker can submit", async () => {
      const rogue = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(rogue.publicKey, LAMPORTS_PER_SOL);
      await provider.connection.confirmTransaction(sig, "confirmed");

      try {
        await program.methods
          .postProof(Array.from(jobId), proofHash)
          .accounts({ worker: rogue.publicKey, job: jobPda })
          .signers([rogue])
          .rpc();
        assert.fail("Rogue worker should be rejected");
      } catch (err: any) {
        assert.include(err.message, "UnauthorizedWorker");
      }
    });

    it("post_proof: rejects empty hash", async () => {
      try {
        await program.methods
          .postProof(Array.from(jobId), new Array(32).fill(0))
          .accounts({ worker: analyst.publicKey, job: jobPda })
          .signers([analyst])
          .rpc();
        assert.fail("Empty hash should be rejected");
      } catch (err: any) {
        assert.include(err.message, "EmptyProofHash");
      }
    });

    it("post_proof: stores hash and transitions to ProofSubmitted", async () => {
      await program.methods
        .postProof(Array.from(jobId), proofHash)
        .accounts({ worker: analyst.publicKey, job: jobPda })
        .signers([analyst])
        .rpc();

      const job = await program.account.job.fetch(jobPda);
      assert.deepEqual(job.status, { proofSubmitted: {} });
      assert.deepEqual(job.proofHash, proofHash);
    });

    it("post_proof: cannot submit twice (status guard)", async () => {
      try {
        await program.methods
          .postProof(Array.from(jobId), proofHash)
          .accounts({ worker: analyst.publicKey, job: jobPda })
          .signers([analyst])
          .rpc();
        assert.fail("Second post_proof should be rejected");
      } catch (err: any) {
        assert.include(err.message, "InvalidJobStatus");
      }
    });

    it("disburse_funds: transfers lamports to worker + updates reputation", async () => {
      const workerBalanceBefore = await provider.connection.getBalance(analyst.publicKey);

      await program.methods
        .disburseFunds(Array.from(jobId))
        .accounts({
          initiator: quant.publicKey,
          worker: analyst.publicKey,
          job: jobPda,
          analystProfile: analystProfilePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([quant])
        .rpc();

      const workerBalanceAfter = await provider.connection.getBalance(analyst.publicKey);
      assert.equal(workerBalanceAfter - workerBalanceBefore, JOB_AMOUNT.toNumber());

      const job = await program.account.job.fetch(jobPda);
      assert.deepEqual(job.status, { disbursed: {} });

      const profile = await program.account.analystProfile.fetch(analystProfilePda);
      assert.equal(profile.jobsCompleted.toNumber(), 1);
      assert.equal(profile.reputationScore.toNumber(), 10_000); // 1/1 * 10000
    });

    it("disburse_funds: cannot disburse twice", async () => {
      try {
        await program.methods
          .disburseFunds(Array.from(jobId))
          .accounts({
            initiator: quant.publicKey,
            worker: analyst.publicKey,
            job: jobPda,
            analystProfile: analystProfilePda,
            systemProgram: SystemProgram.programId,
          })
          .signers([quant])
          .rpc();
        assert.fail("Second disburse should be rejected");
      } catch (err: any) {
        assert.include(err.message, "InvalidJobStatus");
      }
    });
  });

  // ─── Cancel Job ───────────────────────────────────────────────────────────

  describe("cancel_job", () => {
    it("rejects cancellation before expiry", async () => {
      const jobId = randomJobId();
      const [jobPda] = deriveJobPda(program, quant.publicKey, jobId);

      await program.methods
        .initializeJob(Array.from(jobId), JOB_AMOUNT, new BN(3600)) // 1hr expiry
        .accounts({
          initiator: quant.publicKey,
          worker: analyst.publicKey,
          analystProfile: analystProfilePda,
          job: jobPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([quant])
        .rpc();

      try {
        await program.methods
          .cancelJob(Array.from(jobId))
          .accounts({
            initiator: quant.publicKey,
            job: jobPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([quant])
          .rpc();
        assert.fail("Cancel before expiry should be rejected");
      } catch (err: any) {
        assert.include(err.message, "JobNotExpired");
      }
    });

    it("returns funds to initiator after expiry", async () => {
      const jobId = randomJobId();
      const [jobPda] = deriveJobPda(program, quant.publicKey, jobId);

      await program.methods
        .initializeJob(Array.from(jobId), JOB_AMOUNT, new BN(1)) // 1s expiry
        .accounts({
          initiator: quant.publicKey,
          worker: analyst.publicKey,
          analystProfile: analystProfilePda,
          job: jobPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([quant])
        .rpc();

      await sleep(2000); // Let it expire

      const balanceBefore = await provider.connection.getBalance(quant.publicKey);

      await program.methods
        .cancelJob(Array.from(jobId))
        .accounts({
          initiator: quant.publicKey,
          job: jobPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([quant])
        .rpc();

      const balanceAfter = await provider.connection.getBalance(quant.publicKey);
      // Balance should increase (job amount returned minus tx fee)
      assert.isAbove(balanceAfter, balanceBefore);
    });
  });
});
