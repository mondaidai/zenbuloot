import { ethers } from "ethers";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Hardhat environment
import hre from "hardhat";

// Import custom configuration
import { hardhatCustomConfig } from "../config/hardhat-custom-config.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============ CONFIGURATION (Now mostly dynamic) ============
const CONFIG = {
    // These paths remain constant relative to the script location
    PATHS: {
        ARTIFACTS: "../artifacts/contracts",
        FRONTEND_ENV: "../frontend/.env"
    },
    // Deployment settings (mostly constant)
    DEPLOYMENT: {
        DELAY_MS: 500,
        ENV_KEYS: {
            ZENIKANE: "VITE_ZENIKANE_ADDRESS",
            ZENBU_LOOT: "VITE_ZENBU_LOOT_ADDRESS",
            OMAMORI_NFT: "VITE_OMAMORINFT_ADDRESS",
            GAME_ENGINE: "VITE_GAME_ENGINE_ADDRESS",
            AAVE_STRATEGY: "VITE_AAVE_STRATEGY_ADDRESS",
            VAULT: "VITE_VAULT_ADDRESS"
        },
        ZENBU_LOOT_TX_HASH: "VITE_ZENBU_LOOT_TX"
    }
};

// ============ UTILITY FUNCTIONS ============
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// NOTE: loadFactory now uses hardhat's contract names dynamically
const loadFactory = (contractName, signer, contractNames) => {
    let artifactPath;
    const isStrategy = contractName === contractNames.AAVE_STRATEGY;

    if (isStrategy) {
        artifactPath = join(
            __dirname,
            `${CONFIG.PATHS.ARTIFACTS}/strategies/${contractName}.sol/${contractName}.json`
        );
    } else {
        artifactPath = join(
            __dirname,
            `${CONFIG.PATHS.ARTIFACTS}/${contractName}.sol/${contractName}.json`
        );
    }

    if (!existsSync(artifactPath)) {
        throw new Error(`Artifact not found at: ${artifactPath}`);
    }

    const artifact = JSON.parse(readFileSync(artifactPath, "utf-8"));
    return new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
};

const updateFrontendEnv = (contractAddresses, zenbuLootTxHash) => {
    const frontendEnvPath = join(__dirname, CONFIG.PATHS.FRONTEND_ENV);
    let envContent = existsSync(frontendEnvPath) ? readFileSync(frontendEnvPath, "utf-8") : "";

    const envLines = [
        `${CONFIG.DEPLOYMENT.ENV_KEYS.ZENIKANE}=${contractAddresses.zenikane}`,
        `${CONFIG.DEPLOYMENT.ENV_KEYS.ZENBU_LOOT}=${contractAddresses.zenbuLoot}`,
        `${CONFIG.DEPLOYMENT.ZENBU_LOOT_TX_HASH}=${zenbuLootTxHash}`,
        `${CONFIG.DEPLOYMENT.ENV_KEYS.OMAMORI_NFT}=${contractAddresses.omamoriNFT}`,
        `${CONFIG.DEPLOYMENT.ENV_KEYS.GAME_ENGINE}=${contractAddresses.gameEngine}`,
        `${CONFIG.DEPLOYMENT.ENV_KEYS.AAVE_STRATEGY}=${contractAddresses.aaveStrategy}`,
        `${CONFIG.DEPLOYMENT.ENV_KEYS.VAULT}=${contractAddresses.vault}`
    ];

    const existingLines = envContent.split("\n").filter(Boolean);
    envLines.forEach((line) => {
        const [key] = line.split("=");
        const index = existingLines.findIndex((l) => l.startsWith(key));
        if (index >= 0) existingLines[index] = line;
        else existingLines.push(line);
    });

    writeFileSync(frontendEnvPath, existingLines.join("\n") + "\n");
    console.log(`✅ Frontend .env updated at ${frontendEnvPath}`);
};

// ============ ITEM TYPE SETUP ============
async function setupInitialItems(omamoriContract, ownerSigner) {
    console.log("📦 Setting up initial item types...");

    // The item data itself remains the same
    const items = [
        // ... (Item data truncated for brevity, remains the same)
        {
            name: "Success",
            defaultUses: 5,
            imageURI: "/images/red_omamori.png",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 7 * 24 * 60 * 60,
            maxLockDuration: 90 * 24 * 60 * 60,
            price: ethers.parseEther("0.01"),
            apr: 450,
            minInvestment: ethers.parseEther("0.001"),
            maxInvestment: ethers.parseEther("600.0"),
            strategyId: 1
        },
        // ... all other items
        {
            name: "Wealth",
            defaultUses: 0,
            imageURI: "/images/violet_omamori.png",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 500000,
            maxLockDuration: 50 * 24 * 60 * 60,
            price: ethers.parseEther("0.02"),
            apr: 350, // Fixed to 3.5%
            minInvestment: ethers.parseEther("0.09"),
            maxInvestment: ethers.parseEther("300.0"),
            strategyId: 1
        }
    ];

    const typeIds = [];
    let currentNonce = await ownerSigner.getNonce();
    console.log(`📝 Starting with nonce: ${currentNonce}`);

    for (const [index, item] of items.entries()) {
        try {
            console.log(`⏳ Adding "${item.name}" (nonce: ${currentNonce})...`);

            const tx = await omamoriContract.connect(ownerSigner).addItemType(item, {
                nonce: currentNonce
            });
            const receipt = await tx.wait();

            // Find the ItemTypeAdded event
            const event = receipt.logs.find(log =>
                // We use log.fragment for Ethers v6/Hardhat compatibility
                log.fragment && log.fragment.name === 'ItemTypeAdded'
            );
            // Fallback to index if event is not found, although it should be
            const typeId = event ? event.args.typeId.toString() : (index + 1).toString();

            typeIds.push(typeId);
            console.log(`✅ Added "${item.name}" with ID: ${typeId}`);

            currentNonce++;
            await sleep(CONFIG.DEPLOYMENT.DELAY_MS);
        } catch (error) {
            console.error(`❌ Failed to add "${item.name}":`, error.message);
            typeIds.push('Failed');

            if (error.message.includes('nonce')) {
                currentNonce = await ownerSigner.getNonce();
                console.log(`🔄 Updated nonce to: ${currentNonce}`);
            }
        }
    }

    console.log(`🎉 Item types setup completed! Type IDs: ${typeIds.join(', ')}\n`);
    return typeIds;
}

// ============ MAIN DEPLOYMENT FUNCTION ============
async function main() {
    
    // 1. Validate custom configuration exists
    if (!hardhatCustomConfig || !hardhatCustomConfig.contractNames || !hardhatCustomConfig.aaveConfig) {
        console.error("FATAL ERROR: Custom configuration is missing or undefined.");
        throw new Error("Missing Custom Configuration.");
    }
    
    // Access configuration after the safety check
    // Hardhat has issues reporting the correct network name for edr-simulated networks
    // So we check process arguments to find the actual requested network
    let networkName = hre.network.name || 'localhost';
    
    const args = process.argv;
    const networkIndex = args.indexOf('--network');
    if (networkIndex !== -1 && args[networkIndex + 1]) {
        const requestedNetwork = args[networkIndex + 1];
        if (hre.config.networks[requestedNetwork]) {
            networkName = requestedNetwork;
        }
    }
    
    const contractNames = hardhatCustomConfig.contractNames;

    console.log(`🚀 Deploying MydApp contracts to Hardhat network: ${networkName}...\n`);

    // Determine the Aave config based on the resolved network name.
    // For localhost (running against hardhat node), use empty addresses since Aave contracts won't be available
    // For other networks, use the configured addresses
    const aaveConfig = hardhatCustomConfig.aaveConfig[networkName] || hardhatCustomConfig.aaveConfig.mainnet;

    // 2. Get the Signer and Provider from Hardhat config
    const networkConfig = hre.config.networks[networkName];
    
    // Get RPC URL from hardhat config or environment variables
    // For http networks: url is at the top level
    // For edr-simulated networks with forking: url is under forking.url
    let rpcUrl = networkConfig?.url || networkConfig?.forking?.url;
    
    // configVariable() returns an object, not a string, so resolve from env if needed
    if (!rpcUrl || typeof rpcUrl !== 'string') {
        // Localhost defaults to local node
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
        // Use network-specific private key from environment
        const privateKey = process.env[`${networkName.toUpperCase()}_PRIVATE_KEY`];
        signer = new ethers.Wallet(privateKey, provider);
    } else {
        // For networks without explicit private key env var (localhost, hardhat), 
        // use hardhat's default test account
        signer = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider);
    } 

    // 3. Log dynamic information
    console.log(`✓ Deploying from: ${signer.address}`);
    const balance = await provider.getBalance(signer.address);
    console.log(`✓ Account balance: ${ethers.formatEther(balance)} ETH\n`);

    console.log("📋 Aave V3 Dynamic Addresses:");
    console.log(`    Pool: ${aaveConfig.pool}`);
    console.log(`    aWETH: ${aaveConfig.aWETH}`);
    console.log(`    WETH: ${aaveConfig.weth}\n`);

    const contractAddresses = {};

    // Deploy contracts in sequence, using dynamic names
    
    // --- ZENIKANE ---
    console.log(`📝 Deploying ${contractNames.ZENIKANE}...`);
    const zenikaneFactory = loadFactory(contractNames.ZENIKANE, signer, contractNames);
    const zenikane = await zenikaneFactory.deploy();
    await zenikane.waitForDeployment();
    contractAddresses.zenikane = await zenikane.getAddress();
    console.log(`✓ ${contractNames.ZENIKANE} deployed at: ${contractAddresses.zenikane}\n`);
    await sleep(CONFIG.DEPLOYMENT.DELAY_MS);

    // --- OMAMORINFT ---
    console.log(`📝 Deploying ${contractNames.OMAMORI_NFT}...`);
    const omamoriFactory = loadFactory(contractNames.OMAMORI_NFT, signer, contractNames);
    const omamori = await omamoriFactory.deploy();
    await omamori.waitForDeployment();
    contractAddresses.omamoriNFT = await omamori.getAddress();
    console.log(`✓ ${contractNames.OMAMORI_NFT} deployed at: ${contractAddresses.omamoriNFT}\n`);
    await sleep(CONFIG.DEPLOYMENT.DELAY_MS);

    // --- GAME_ENGINE ---
    console.log(`📝 Deploying ${contractNames.GAME_ENGINE}...`);
    const gameEngineFactory = loadFactory(contractNames.GAME_ENGINE, signer, contractNames);
    const gameEngine = await gameEngineFactory.deploy();
    await gameEngine.waitForDeployment();
    contractAddresses.gameEngine = await gameEngine.getAddress();
    console.log(`✓ ${contractNames.GAME_ENGINE} deployed at: ${contractAddresses.gameEngine}\n`);
    await sleep(CONFIG.DEPLOYMENT.DELAY_MS);

    // --- VAULT ---
    console.log(`📝 Deploying ${contractNames.VAULT}...`);
    const vaultFactory = loadFactory(contractNames.VAULT, signer, contractNames);
    const vault = await vaultFactory.deploy(contractAddresses.omamoriNFT);
    await vault.waitForDeployment();
    contractAddresses.vault = await vault.getAddress();
    console.log(`✓ ${contractNames.VAULT} deployed at: ${contractAddresses.vault}\n`);
    await sleep(CONFIG.DEPLOYMENT.DELAY_MS);

    // --- AAVE_STRATEGY ---
    console.log(`📝 Deploying ${contractNames.AAVE_STRATEGY} with dynamic Aave addresses...`);
    try {
        const aaveStrategyFactory = loadFactory(contractNames.AAVE_STRATEGY, signer, contractNames);
        const aaveStrategy = await aaveStrategyFactory.deploy(
            contractAddresses.vault,
            aaveConfig.pool,
            aaveConfig.aWETH,
            aaveConfig.weth
        );
        await aaveStrategy.waitForDeployment();
        contractAddresses.aaveStrategy = await aaveStrategy.getAddress();
        console.log(`✓ ${contractNames.AAVE_STRATEGY} deployed at: ${contractAddresses.aaveStrategy}\n`);
    } catch (err) {
        console.warn(`⚠ Could not deploy ${contractNames.AAVE_STRATEGY}: ${err.message}`);
        console.warn(`  This is expected on local testnet if Aave contracts are not available.\n`);
        contractAddresses.aaveStrategy = "0x0000000000000000000000000000000000000000"; // Placeholder
    }
    await sleep(CONFIG.DEPLOYMENT.DELAY_MS);

    // --- ZENBU_LOOT ---
    let zenbuLootTxHash;
    console.log(`📝 Deploying ${contractNames.ZENBU_LOOT}...`);
    const zenbuLootFactory = loadFactory(contractNames.ZENBU_LOOT, signer, contractNames);
    const zenbuLoot = await zenbuLootFactory.deploy(
        contractAddresses.zenikane,
        contractAddresses.omamoriNFT,
        contractAddresses.gameEngine,
        contractAddresses.vault
    );
    zenbuLootTxHash = zenbuLoot.deploymentTransaction().hash;
    await zenbuLoot.waitForDeployment();
    contractAddresses.zenbuLoot = await zenbuLoot.getAddress();
    console.log(`✓ ${contractNames.ZENBU_LOOT} deployment transaction hash: ${zenbuLootTxHash}`);
    console.log(`✓ ${contractNames.ZENBU_LOOT} deployed at: ${contractAddresses.zenbuLoot}\n`);
    await sleep(CONFIG.DEPLOYMENT.DELAY_MS);

    // ============ POST-DEPLOYMENT SETUP ============

    console.log(`📝 Authorizing ${contractNames.ZENBU_LOOT} in ${contractNames.OMAMORI_NFT}...`);
    const authTx = await omamori.addAuthorized(contractAddresses.zenbuLoot);
    await authTx.wait();
    console.log(`✓ ${contractNames.ZENBU_LOOT} authorized in ${contractNames.OMAMORI_NFT}\n`);
    await sleep(CONFIG.DEPLOYMENT.DELAY_MS);

    console.log(`📝 Initializing ${contractNames.VAULT} contract...`);
    const initVault = await vault.initialize(contractAddresses.zenbuLoot);
    await initVault.wait();
    console.log(`✓ ${contractNames.VAULT} initialized with ${contractNames.ZENBU_LOOT} address\n`);
    await sleep(CONFIG.DEPLOYMENT.DELAY_MS);

    console.log(`📝 Initializing ${contractNames.ZENIKANE} contract...`);
    const initZenikane = await zenikane.initialize(contractAddresses.zenbuLoot);
    await initZenikane.wait();
    console.log(`✓ ${contractNames.ZENIKANE} initialized with ${contractNames.ZENBU_LOOT} address\n`);
    await sleep(CONFIG.DEPLOYMENT.DELAY_MS);

    console.log(`📝 Initializing ${contractNames.GAME_ENGINE} contract...`);
    const initGameEngine = await gameEngine.initialize(contractAddresses.zenbuLoot);
    await initGameEngine.wait();
    console.log(`✓ ${contractNames.GAME_ENGINE} initialized with ${contractNames.ZENBU_LOOT} address\n`);
    await sleep(CONFIG.DEPLOYMENT.DELAY_MS);

    console.log(`📝 Registering ${contractNames.AAVE_STRATEGY} in ${contractNames.VAULT}...`);
    try {
        const registerStrategyTx = await vault.registerStrategy(1, contractAddresses.aaveStrategy);
        await registerStrategyTx.wait();
        console.log(`✓ ${contractNames.AAVE_STRATEGY} registered in ${contractNames.VAULT} with ID: 1\n`);
    } catch (err) {
        console.warn(`⚠ Could not register ${contractNames.AAVE_STRATEGY}: ${err.message}\n`);
    }

    console.log(`📝 Setting up initial item types in ${contractNames.OMAMORI_NFT}...`);
    const initialTypeIds = await setupInitialItems(omamori, signer);

    updateFrontendEnv(contractAddresses, zenbuLootTxHash);

    // ============ DEPLOYMENT SUMMARY ============
    const separator = "=".repeat(60);
    console.log(`\n${separator}`);
    console.log(`✅ DEPLOYMENT COMPLETE - NETWORK: ${networkName.toUpperCase()}!`);
    console.log(separator);
    console.log(`📦 ${contractNames.ZENBU_LOOT}: ${contractAddresses.zenbuLoot}`);
    console.log(`💰 ${contractNames.ZENIKANE}: ${contractAddresses.zenikane}`);
    console.log(`🎴 ${contractNames.OMAMORI_NFT}: ${contractAddresses.omamoriNFT}`);
    console.log(`🎮 ${contractNames.GAME_ENGINE}: ${contractAddresses.gameEngine}`);
    console.log(`🏦 ${contractNames.VAULT}: ${contractAddresses.vault}`);
    console.log(`📈 ${contractNames.AAVE_STRATEGY}: ${contractAddresses.aaveStrategy}`);
}

// ============ EXECUTION AND ERROR HANDLING ============

// Hardhat requires calling this function to start the deployment process.
// This is the correct, standard pattern to run an async main function 
// in an ES module and catch any errors.
main()
    .then(() => {
        // Successful exit
        process.exit(0);
    })
    .catch((error) => {
        // Log the error and exit with a failure code
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    });