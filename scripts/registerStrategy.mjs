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
        DELAY_MS: 500
    }
};

// ============ UTILITY FUNCTIONS ============ 
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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


const getExistingAddresses = () => {
    const frontendEnvPath = join(__dirname, CONFIG.PATHS.FRONTEND_ENV);
    
    if (!existsSync(frontendEnvPath)) {
        throw new Error("Frontend .env file not found. Please deploy all contracts first.");
    }

    const envContent = readFileSync(frontendEnvPath, "utf-8");
    const lines = envContent.split("\n").filter(Boolean);
    
    const addresses = {};
    
    lines.forEach(line => {
        const [key, value] = line.split("=");
        if (value) {
            // Extract contract name from env key
            const contractMatch = key.match(/VITE_(.+)_ADDRESS/);
            if (contractMatch) {
                const contractName = contractMatch[1].toLowerCase();
                addresses[contractName] = value;
            }
        }
    });

    return addresses;
};

// ============ STRATEGY REGISTRATION FUNCTION ============ 
async function main() {
    // 1. Validate custom configuration exists
    if (!hardhatCustomConfig || !hardhatCustomConfig.contractNames || !hardhatCustomConfig.aaveConfig) {
        console.error("FATAL ERROR: Custom configuration is missing or undefined.");
        throw new Error("Missing Custom Configuration.");
    }

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

    console.log(`🚀 Registering new strategy in Vault on network: ${networkName}...
`);
    
    const aaveConfig = hardhatCustomConfig.aaveConfig[networkName] || hardhatCustomConfig.aaveConfig.mainnet;

    // 2. Get the Signer and Provider from Hardhat config
    const [signer] = await hre.ethers.getSigners();
    
    // 3. Log dynamic information
    console.log(`✓ Deploying from: ${signer.address}`);
    const balance = await hre.ethers.provider.getBalance(signer.address);
    console.log(`✓ Account balance: ${ethers.formatEther(balance)} ETH
`);

    console.log("📋 Aave V3 Dynamic Addresses:");
    console.log(`    Pool: ${aaveConfig.pool}`);
    console.log(`    aWETH: ${aaveConfig.aWETH}`);
    console.log(`    WETH: ${aaveConfig.weth}
`);

    try {
        
        // Get existing contract addresses
        console.log("📋 Loading existing contract addresses...");
        const addresses = getExistingAddresses();
        
        console.log("\n📄 Found addresses:");
        console.log(`   🏦 Vault: ${addresses.vault}`);
        console.log(`   💰 Zenikane: ${addresses.zenikane}`);
        console.log(`   🎴 OmamoriNFT: ${addresses.omamorinft}`);
        
        if (!addresses.vault) {
            throw new Error("Vault address not found in .env file");
        }
        
        const aaveStrategyFactory = loadFactory(contractNames.AAVE_STRATEGY, signer, contractNames);
        
        const aaveStrategy = await aaveStrategyFactory.deploy(
            addresses.vault,          // Vault address
            aaveConfig.pool,         // Aave Pool
            aaveConfig.aWETH,        // aWETH address
            aaveConfig.weth          // WETH address
        );
        
        await aaveStrategy.waitForDeployment();
        const strategyAddress = await aaveStrategy.getAddress();
        console.log(`   ✓ AaveStrategy deployed: ${strategyAddress}`);
        
        await sleep(CONFIG.DEPLOYMENT.DELAY_MS);
        
        // Register strategy in Vault
        console.log(`\n📝 Registering strategy in Vault...`);
        
        const vaultWithInterface = new hre.ethers.Contract(
            addresses.vault,
            ["function registerStrategy(uint256 id, address strategy) external"],
            signer
        );
        
        const registerTx = await vaultWithInterface.registerStrategy(1, strategyAddress);
        await registerTx.wait();
        
        // Update frontend .env
        console.log("\n🌐 Updating frontend configuration...");
        const frontendEnvPath = join(__dirname, CONFIG.PATHS.FRONTEND_ENV);
        let envContent = readFileSync(frontendEnvPath, "utf-8");
        
        // Add or update the strategy address
        const strategyKey = `VITE_AAVE_STRATEGY_ADDRESS`;
        const strategyLine = `${strategyKey}=${strategyAddress}`;
        
        const lines = envContent.split("\n").filter(Boolean);
        let found = false;
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith(strategyKey)) {
                lines[i] = strategyLine;
                found = true;
                break;
            }
        }
        
        if (!found) {
            lines.push(strategyLine);
        }
        
        writeFileSync(frontendEnvPath, lines.join("\n") + "\n");
        console.log(`✅ Frontend .env updated`);
        
        // Summary
        const separator = "=".repeat(60);
        console.log(`\n${separator}`);
        console.log("🎉 STRATEGY REGISTRATION COMPLETE!");
        console.log(separator);
        console.log(`📍 Strategy Address: ${strategyAddress}`);
        console.log(`🏦 Vault: ${addresses.vault}`);
        console.log(separator);
        console.log("\n✅ New strategy registered successfully!");
        
    } catch (error) {
        console.error("\n❌ Strategy registration failed:", error.message);
        process.exit(1);
    }
}

// ============ EXECUTION AND ERROR HANDLING ============ 
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
