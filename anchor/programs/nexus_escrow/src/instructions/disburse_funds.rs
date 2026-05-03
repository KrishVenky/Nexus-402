use anchor_lang::prelude::*;
use crate::state::{Job, JobStatus, AnalystProfile};
use crate::errors::NexusEscrowError;

#[derive(Accounts)]
#[instruction(job_id: [u8; 32])]
pub struct DisburseFunds<'info> {
    #[account(mut)]
    pub initiator: Signer<'info>,

    /// CHECK: Validated via job.worker constraint below
    #[account(mut)]
    pub worker: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"job", initiator.key().as_ref(), job_id.as_ref()],
        bump = job.bump,
        constraint = job.initiator == initiator.key() @ NexusEscrowError::Unauthorized,
        constraint = job.worker == worker.key() @ NexusEscrowError::UnauthorizedWorker,
        constraint = job.status == JobStatus::ProofSubmitted @ NexusEscrowError::InvalidJobStatus,
    )]
    pub job: Account<'info, Job>,

    #[account(
        mut,
        seeds = [b"analyst", worker.key().as_ref()],
        bump = analyst_profile.bump,
        constraint = analyst_profile.owner == worker.key()
    )]
    pub analyst_profile: Account<'info, AnalystProfile>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DisburseFunds>, _job_id: [u8; 32]) -> Result<()> {
    let amount = ctx.accounts.job.amount_lamports;

    // Transfer lamports from Job PDA to worker wallet
    // WHY: Use raw lamport manipulation for PDA-owned accounts (no keypair to sign CPI)
    {
        let job_info = ctx.accounts.job.to_account_info();
        let worker_info = ctx.accounts.worker.to_account_info();

        **job_info.try_borrow_mut_lamports()? = job_info
            .lamports()
            .checked_sub(amount)
            .ok_or(NexusEscrowError::MathOverflow)?;

        **worker_info.try_borrow_mut_lamports()? = worker_info
            .lamports()
            .checked_add(amount)
            .ok_or(NexusEscrowError::MathOverflow)?;
    }

    // Update job status
    ctx.accounts.job.status = JobStatus::Disbursed;

    // Update analyst reputation
    ctx.accounts.analyst_profile.update_reputation(true);

    msg!(
        "Disbursed {} lamports to {} | reputation: {}",
        amount,
        ctx.accounts.worker.key(),
        ctx.accounts.analyst_profile.reputation_score
    );

    Ok(())
}
