# Provvy X Layer Contracts

Foundry package for Provvy's X Layer Testnet commercial commitment registry.

## Network

- X Layer Testnet
- Chain ID: 1952
- RPC: https://testrpc.xlayer.tech/terigon

## CommitmentRegistry

Deployed address:

0x67163764926E877Aa3bF8AB89c22CC7BBcC06C45

The registry is non-custodial and does not hold or transfer funds.

## Development

This package vendors `forge-std` under `lib/forge-std` so the contract tests and deployment script remain reproducible without introducing another Git submodule into the repository.

Generated Foundry output (`out/`, `cache/`, `broadcast/`) is intentionally ignored.