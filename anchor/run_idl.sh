#!/bin/bash
export PATH="/home/krish/.nvm/versions/node/v20.10.0/bin:$PATH"
export PATH="/home/krish/.cargo/bin:$PATH"
export PATH="/home/krish/.local/share/solana/install/active_release/bin:$PATH"
cd /mnt/c/Users/krish/vscode/SolanaHackathon/anchor
anchor idl build
