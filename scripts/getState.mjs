import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import hre from "hardhat";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: join(__dirname, "../frontend/.env") });
dotenv.config({ path: join(__dirname, "../.env") });

function loadArtifact(name, isStrategy = false) {
    const filePath = isStrategy
        ? join(__dirname, `../artifacts/contracts/strategies/${name}.sol/${name}.json`)
        : join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);

    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// ========== LOAD ADDRESSES FROM FRONTEND .env ==========

const {
    VITE_AAVE_STRATEGY_ADDRESS,
    VITE_VAULT_ADDRESS,
    VITE_ZENBU_LOOT_ADDRESS,
    VITE_ZENIKANE_ADDRESS
} = process.env;

if (!VITE_AAVE_STRATEGY_ADDRESS || !VITE_VAULT_ADDRESS || !VITE_ZENBU_LOOT_ADDRESS || !VITE_ZENIKANE_ADDRESS) {
    console.error("❌ Missing one or more required contract addresses in frontend/.env");
    console.error(`   Make sure you've deployed contracts with: npx hardhat run scripts/deploy.mjs --network ${networkName}`);
    process.exit(1);
}

// ========== HARDHAT NETWORK SETUP ==========

// Determine network name from --network flag
let networkName = hre.network.name || 'localhost';

const args = process.argv;
const networkIndex = args.indexOf('--network');
if (networkIndex !== -1 && args[networkIndex + 1]) {
    const requestedNetwork = args[networkIndex + 1];
    if (hre.config.networks[requestedNetwork]) {
        networkName = requestedNetwork;
    }
}

const networkConfig = hre.config.networks[networkName];

// Get RPC URL from hardhat config or environment variables
let rpcUrl = networkConfig?.url || networkConfig?.forking?.url;

if (!rpcUrl || typeof rpcUrl !== 'string') {
    if (networkName === 'localhost') {
        rpcUrl = 'http://127.0.0.1:8545';
    } else {
        const envKey = `${networkName.toUpperCase()}_RPC_URL`;
        rpcUrl = process.env[envKey];
    }
}

if (!rpcUrl) {
    throw new Error(`No RPC URL configured for network: ${networkName}. Set ${networkName.toUpperCase()}_RPC_URL env var or configure it in hardhat.config.ts`);
}

const provider = new ethers.JsonRpcProvider(rpcUrl);

// Create signer
let signer;
if (process.env[`${networkName.toUpperCase()}_PRIVATE_KEY`]) {
    const privateKey = process.env[`${networkName.toUpperCase()}_PRIVATE_KEY`];
    signer = new ethers.Wallet(privateKey, provider);
} else {
    // For networks without explicit private key env var (localhost, hardhat),
    // use hardhat's default test account
    signer = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
}


// ========== LOAD CONTRACTS ==========

const aaveStrategy = new ethers.Contract(
    VITE_AAVE_STRATEGY_ADDRESS,
    loadArtifact("AaveStrategy", true).abi,
    signer
);

const vault = new ethers.Contract(
    VITE_VAULT_ADDRESS,
    loadArtifact("Vault").abi,
    signer
);

const zenbuLoot = new ethers.Contract(
    VITE_ZENBU_LOOT_ADDRESS,
    loadArtifact("ZenbuLoot").abi,
    signer
);

const zkn = new ethers.Contract(
    VITE_ZENIKANE_ADDRESS,
    loadArtifact("Zenikane").abi,
    signer
);

// ========== READ STATE ==========

async function main() {
    console.log(`📡 Reading on-chain state from ${networkName}...\\n`);

    const decimals = await zkn.decimals();

    const strategyInfo = await aaveStrategy.getStrategyInfo();

    // Instead of trusting aWETH.balanceOf(), compute "current value" manually
    const principalETH = ethers.formatEther(strategyInfo.principalETH);
    const harvestableYieldETH = ethers.formatEther(strategyInfo.harvestableYieldETH);
    const currentValueETH = (parseFloat(principalETH) + parseFloat(harvestableYieldETH)).toString();

    const totalHarvestable = await vault.getTotalHarvestableYield();
    const profitInfo = await zenbuLoot.getProfitInfo();
    const feeSettings = await zenbuLoot.fees();

    const totalZKNFeesCollected = profitInfo[0];
    const withdrawableZKN = profitInfo[1];
    const collectedFees = profitInfo[2];

    const profitReadable = {
        totalZKNFeesCollected: ethers.formatUnits(totalZKNFeesCollected, decimals),
        withdrawableZKN: ethers.formatUnits(withdrawableZKN, decimals),
        gameFeeZKN: ethers.formatUnits(collectedFees.gameFee, decimals),
        performanceFeeZKN: ethers.formatUnits(collectedFees.performanceFee, decimals)
    };
    const feeSettingsReadable = {
        nftPurchaseFeePercent: Number(feeSettings.nftPurchaseFee) / 10000,
        zknBuyFeePercent: Number(feeSettings.zknBuyFee) / 10000,
        zknSellFeePercent: Number(feeSettings.zknSellFee) / 10000,
        gameFeePercent: Number(feeSettings.gameFee) / 10000,
        performanceFeePercent: Number(feeSettings.performanceFee) / 10000
    };

    console.log("====== AAVE STRATEGY INFO ======");
    console.log("Principal (ETH):", principalETH);
    console.log("Current Value (ETH):", currentValueETH);
    console.log("Harvestable Yield (ETH):", harvestableYieldETH);
    console.log("aWETH Balance (raw):", strategyInfo.aWETHBalance.toString());
    console.log();

    console.log("====== VAULT INFO ======");
    console.log("Total Harvestable (ETH):", ethers.formatEther(totalHarvestable));
    console.log();

    console.log("====== ZENBU LOOT PROFIT INFO ======");
    console.log("ZKN Fees Collected:", profitReadable.totalZKNFeesCollected);
    console.log("Withdrawable ZKN:", profitReadable.withdrawableZKN);
    console.log();
    console.log("Fees Breakdown:");
    console.log(" - Game Fee (ZKN):", profitReadable.gameFeeZKN);
    console.log(" - Performance Fee (ZKN):", profitReadable.performanceFeeZKN);
    console.log("Fees Settings:");
    console.log(" - NFT Purchase Fee :", feeSettingsReadable.nftPurchaseFeePercent, "%");
    console.log(" - ZKN Buy Fee :", feeSettingsReadable.zknBuyFeePercent, "%");
    console.log(" - ZKN Sell Fee :", feeSettingsReadable.zknSellFeePercent, '%');
    console.log(" - Game Fee :", feeSettingsReadable.gameFeePercent, "%");
    console.log(" - Performance Fee :", feeSettingsReadable.performanceFeePercent, "%");
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error("\\n❌ Error reading state:", error);
        process.exit(1);
    });
