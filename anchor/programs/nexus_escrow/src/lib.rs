use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod nexus_escrow {
    use super::*;

    /// Register a new analyst agent profile with a stake deposit.
    /// Requires >= 0.01 SOL stake (Sybil resistance).
    pub fn initialize_analyst_profile(
        ctx: Context<InitializeAnalystProfile>,
        stake_amount: u64,
    ) -> Result<()> {
        initialize_analyst_profile::handler(ctx, stake_amount)
    }

    /// Create a new job PDA and lock payment from initiator.
    /// Worker must have a registered analyst profile.
    pub fn initialize_job(
        ctx: Context<InitializeJob>,
        job_id: [u8; 32],
        amount_lamports: u64,
        expiry_seconds: Option<i64>,
    ) -> Result<()> {
        initialize_job::handler(ctx, job_id, amount_lamports, expiry_seconds)
    }

    /// Worker submits SHA-256 proof hash of completed sentiment analysis.
    /// Transitions job from Initialized → ProofSubmitted.
    pub fn post_proof(
        ctx: Context<PostProof>,
        job_id: [u8; 32],
        proof_hash: [u8; 32],
    ) -> Result<()> {
        post_proof::handler(ctx, job_id, proof_hash)
    }

    /// Initiator releases locked funds to worker after verifying proof.
    /// Updates analyst reputation score on-chain.
    pub fn disburse_funds(ctx: Context<DisburseFunds>, job_id: [u8; 32]) -> Result<()> {
        disburse_funds::handler(ctx, job_id)
    }

    /// Initiator reclaims funds after job expiry.
    /// Only callable after expires_at timestamp has passed.
    pub fn cancel_job(ctx: Context<CancelJob>, job_id: [u8; 32]) -> Result<()> {
        cancel_job::handler(ctx, job_id)
    }
}
