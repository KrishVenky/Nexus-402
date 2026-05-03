use anchor_lang::prelude::*;
use crate::state::{Job, JobStatus, AnalystProfile};
use crate::errors::NexusEscrowError;

pub const MIN_JOB_AMOUNT: u64 = 1_000;
pub const DEFAULT_EXPIRY_SECONDS: i64 = 300; // 5 minutes

#[derive(Accounts)]
#[instruction(job_id: [u8; 32])]
pub struct InitializeJob<'info> {
    #[account(mut)]
    pub initiator: Signer<'info>,

    /// CHECK: Validated by existence of analyst_profile with matching owner
    pub worker: AccountInfo<'info>,

    /// Worker must have a registered profile (Sybil resistance gate)
    #[account(
        seeds = [b"analyst", worker.key().as_ref()],
        bump = analyst_profile.bump,
        constraint = analyst_profile.owner == worker.key()
    )]
    pub analyst_profile: Account<'info, AnalystProfile>,

    #[account(
        init,
        payer = initiator,
        space = 8 + Job::INIT_SPACE,
        seeds = [b"job", initiator.key().as_ref(), job_id.as_ref()],
        bump
    )]
    pub job: Account<'info, Job>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeJob>,
    job_id: [u8; 32],
    amount_lamports: u64,
    expiry_seconds: Option<i64>,
) -> Result<()> {
    require!(
        amount_lamports >= MIN_JOB_AMOUNT,
        NexusEscrowError::JobAmountTooLow
    );

    // Transfer payment from initiator to job PDA
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.initiator.to_account_info(),
            to: ctx.accounts.job.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_ctx, amount_lamports)?;

    let clock = Clock::get()?;
    let expires_at = clock.unix_timestamp
        .checked_add(expiry_seconds.unwrap_or(DEFAULT_EXPIRY_SECONDS))
        .ok_or(NexusEscrowError::MathOverflow)?;

    let job = &mut ctx.accounts.job;
    job.initiator = ctx.accounts.initiator.key();
    job.worker = ctx.accounts.worker.key();
    job.job_id = job_id;
    job.amount_lamports = amount_lamports;
    job.proof_hash = [0u8; 32];
    job.status = JobStatus::Initialized;
    job.expires_at = expires_at;
    job.created_at = clock.unix_timestamp;
    job.bump = ctx.bumps.job;

    msg!(
        "Job initialized: {} lamports locked for worker {} | expires {}",
        amount_lamports,
        ctx.accounts.worker.key(),
        expires_at
    );

    Ok(())
}
