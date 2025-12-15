# **ZenbuLoot**

ZenbuLoot is a blockchain-based investment and gaming platform built on smart contracts.
Users purchase **NFTs representing investment strategies**, lock funds, and receive **instant credit** in the in-app currency **Zenikane (ZKN)**.
While the investment is locked, users can spend ZKN to play a **Pick-a-Chance** luck-based game.
Profits earned through gameplay are fully withdrawable as long as the user's balance remains above the original locked amount.

---

## ⭐ **Key Features**

* **Investment Strategy NFTs**
  Buy NFTs that represent different yield strategies (e.g., Aave-based strategies).

* **Instant Profit Credit (ZKN)**
  When investing, users immediately receive ZKN equal to the lock APY reward.

* **Lock-Based Withdrawals**
  After the lock period ends, investors can withdraw their real profit.

* **On-Chain Casino Game**
  Use ZKN to play an inApp Pick-a-Chance style game; winnings can be withdrawn.

* **Upgradeable, Modular Architecture**
  Separate Vault, GameEngine, Loot, and NFT contracts for clean separation of logic.

---

# 📁 **Project Structure**

```
ZenbuLoot/
│
├── contracts/                # Solidity smart contracts
├── scripts/                  # Deployment & utility scripts
├── artifacts/                # Auto-generated compiler output
├── frontend/                 # Web frontend (React / Vite / Next.js)
└── hardhat.config.ts         # Hardhat configuration
```

---

# 🚀 **Getting Started**

Follow these steps to set up and run the entire ZenbuLoot dApp (backend + frontend).

---

## 1️⃣ **Clone the Repository**

```bash
git clone <repo>
cd <repo>
```

---

## 2️⃣ **Install Backend Dependencies**

```bash
npm install
```

---

## 3️⃣ **Compile Solidity Contracts**

```bash
npx hardhat compile
```

This generates artifacts containing ABI + bytecode.

---

## 4️⃣ **Run a Blockchain Network**

### Local Hardhat Mainnet Fork 

```bash
npx hardhat node --network hardhat
```

---

## 5️⃣ **Deploy Smart Contracts**

```bash
npx hardhat run scripts/deploy.mjs # --network sepolia or mainnet
```

Deployment info (contract addresses, artifacts) will be saved according to your script’s logic.

---

## 6️⃣ **Start the Frontend**

```bash
cd frontend
npm install
```

---

## 7️⃣ **Copy Contract Artifacts for the Frontend**

```bash
npm run copy-artifacts
```

This moves ABIs + metadata to:

```
frontend/contracts/
```

---

## 8️⃣ **Run the Frontend App**

```bash
npm run dev
```

---

# ⚙️ **Environment Variables**

Create `.env` in the root directory:

```
MAINNET_RPC_URL=
SEPOLIA_RPC_URL=
SEPOLIA_PRIVATE_KEY=
```

(Contract addresses depend on deployment.)

---

# 📝 **How does it work**

1. User purchases an NFT representing an investment strategy.
2. User invests (locks funds) through the Vault.
3. Upon locking, user immediately receives ZKN tokens equal to the expected APY.
4. ZKN can be spent on the Pick-a-Chance casino-like game, powered by GameEngine.
5.  Real investment yield is unlocked after the lock period.

---

# 📝 **Available Scripts**

### Essential commands/scripts 
```bash
$ npx hardhat compile # compile contracts 
$ npx hardhat node --network hardhat # this will run mainnet fork local node, needed if deploying locally
$ npx hardhat run scripts/deploy.mjs --network sepolia # or --network localhost
$ npx hardhat run scripts/getState.mjs --network sepolia # outputs current stats of deployed contracts (fee settings etc.)
```
### Run frontend
```bash
$ npm run copy-artifacts # run this after making changes to contracts and compiling them, otherwise just continue with:
$ npm run dev
```
---
