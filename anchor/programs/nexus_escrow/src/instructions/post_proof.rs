use anchor_lang::prelude::*;
use crate::state::{Job, JobStatus};
use crate::errors::NexusEscrowError;

#[derive(Accounts)]
#[instruction(job_id: [u8; 32])]
pub struct PostProof<'info> {
    pub worker: Signer<'info>,

    #[account(
        mut,
        seeds = [b"job", job.initiator.as_ref(), job_id.as_ref()],
        bump = job.bump,
        constraint = job.worker == worker.key() @ NexusEscrowError::UnauthorizedWorker,
        constraint = job.status == JobStatus::Initialized @ NexusEscrowError::InvalidJobStatus,
    )]
    pub job: Account<'info, Job>,
}

pub fn handler(ctx: Context<PostProof>, _job_id: [u8; 32], proof_hash: [u8; 32]) -> Result<()> {
    // Reject empty (all-zero) proof hashes
    require!(
        proof_hash != [0u8; 32],
        NexusEscrowError::EmptyProofHash
    );

    // Reject if job has expired — Quant Agent should cancel instead
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp < ctx.accounts.job.expires_at,
        NexusEscrowError::JobExpired
    );

    let job = &mut ctx.accounts.job;
    job.proof_hash = proof_hash;
    job.status = JobStatus::ProofSubmitted;

    msg!(
        "Proof submitted for job by worker {} | hash: {:?}",
        ctx.accounts.worker.key(),
        &proof_hash[..8] // Log first 8 bytes only
    );

    Ok(())
}
