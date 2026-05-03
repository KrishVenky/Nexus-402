use anchor_lang::prelude::*;
use crate::state::{Job, JobStatus};
use crate::errors::NexusEscrowError;

#[derive(Accounts)]
#[instruction(job_id: [u8; 32])]
pub struct CancelJob<'info> {
    #[account(mut)]
    pub initiator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"job", initiator.key().as_ref(), job_id.as_ref()],
        bump = job.bump,
        constraint = job.initiator == initiator.key() @ NexusEscrowError::Unauthorized,
        constraint = job.status == JobStatus::Initialized @ NexusEscrowError::InvalidJobStatus,
        close = initiator  // Returns rent + locked funds to initiator on close
    )]
    pub job: Account<'info, Job>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CancelJob>, _job_id: [u8; 32]) -> Result<()> {
    let clock = Clock::get()?;

    // Enforce expiry: cannot cancel before the deadline
    require!(
        clock.unix_timestamp >= ctx.accounts.job.expires_at,
        NexusEscrowError::JobNotExpired
    );

    // Account is closed by `close = initiator` — lamports auto-returned
    msg!(
        "Job cancelled by {} | {} lamports returned",
        ctx.accounts.initiator.key(),
        ctx.accounts.job.amount_lamports
    );

    Ok(())
}
