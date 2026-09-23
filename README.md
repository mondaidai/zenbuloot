# ZenbuLoot

ZenbuLoot is a blockchain application built around investment strategy NFTs,
the Zenikane (ZKN) in-app currency, and the Pick-a-Chance game.

## Features

- Investment strategy NFTs backed by yield strategies such as Aave.
- ZKN credit issued when an investment is locked.
- Vault-based locking and withdrawals.
- An on-chain Pick-a-Chance game using ZKN.
- Separate contracts for the vault, game engine, loot, and NFTs.

## Project layout

```text
contracts/       Solidity contracts
scripts/         Deployment and utility scripts
frontend/        React/Vite application
docs/            Production frontend output for GitHub Pages
artifacts/       Hardhat compiler output
```

## Setup

Install the root dependencies:

```bash
npm install
```

Compile the contracts:

```bash
npx hardhat compile
```

Copy the generated contract ABIs into the frontend:

```bash
cd frontend
npm install
npm run copy-artifacts
```

Create a root `.env` file with the RPC and deployment settings required by the
scripts:

```env
MAINNET_RPC_URL=
SEPOLIA_RPC_URL=
SEPOLIA_PRIVATE_KEY=
```

## Run locally

Start a local Hardhat node in one terminal:

```bash
npx hardhat node
```

Deploy the contracts in another terminal:

```bash
npx hardhat run scripts/deploy.mjs --network localhost
```

Start the frontend:

```bash
cd frontend
npm run dev
```

## Deploy the frontend

The Vite build writes to the root `docs/` directory, which is suitable for
GitHub Pages configured to deploy from the repository's `/docs` folder.

```bash
cd frontend
npm run build
```

For a production preview:

```bash
npm run preview
```

## Useful commands

```bash
npx hardhat compile
npx hardhat run scripts/getState.mjs --network sepolia
cd frontend && npm run copy-artifacts
cd frontend && npm run build
```
