use anchor_lang::prelude::*;
use crate::state::{AnalystProfile};
use crate::errors::NexusEscrowError;

#[derive(Accounts)]
pub struct InitializeAnalystProfile<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = 8 + AnalystProfile::INIT_SPACE,
        seeds = [b"analyst", owner.key().as_ref()],
        bump
    )]
    pub analyst_profile: Account<'info, AnalystProfile>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeAnalystProfile>, stake_amount: u64) -> Result<()> {
    require!(
        stake_amount >= AnalystProfile::MIN_STAKE,
        NexusEscrowError::InsufficientStake
    );

    // Transfer stake from owner to analyst_profile PDA
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: ctx.accounts.analyst_profile.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_ctx, stake_amount)?;

    let profile = &mut ctx.accounts.analyst_profile;
    let clock = Clock::get()?;

    profile.owner = ctx.accounts.owner.key();
    profile.stake_amount = stake_amount;
    profile.jobs_completed = 0;
    profile.jobs_attempted = 0;
    profile.reputation_score = 0;
    profile.reputation_nft = None;
    profile.registered_at = clock.unix_timestamp;
    profile.bump = ctx.bumps.analyst_profile;

    msg!(
        "AnalystProfile created for {} with stake {} lamports",
        profile.owner,
        stake_amount
    );

    Ok(())
}
