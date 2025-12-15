// scripts/checkAaveAddresses.mjs
import { ethers } from "ethers";
import dotenv from "dotenv";
import hre from "hardhat";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: join(__dirname, "../.env") });

// --- Aave V3 Addresses by Network ---
const AAVE_ADDRESSES = {
    sepolia: {
        UI_POOL_DATA_PROVIDER: "0x69529987FA4A075D0C00B0128fa848dc9ebbE9CE",
        POOL_ADDRESSES_PROVIDER: "0x012bAC54348C0E635dCAc9D5FB99f06F24136C9A"
    },
    mainnet: {
        UI_POOL_DATA_PROVIDER: "0x3F78BBD206e4D3c504Eb854232EdA7e47E9Fd8FC",
        POOL_ADDRESSES_PROVIDER: "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e"
    }
};

// ABI for the UiPoolDataProviderV3 contract
// Source: https://optimistic.etherscan.io/address/0xbd83DdBE37fc91923d59C8c1E0bDe0CccCa332d5#code[citation:5]
const UI_POOL_DATA_PROVIDER_ABI = [
    "function getReservesData(address provider) view returns ((address underlyingAsset, string name, string symbol, uint256 decimals, uint256 baseLTVasCollateral, uint256 reserveLiquidationThreshold, uint256 reserveLiquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool stableBorrowRateEnabled, bool isActive, bool isFrozen, uint256 liquidityIndex, uint256 variableBorrowIndex, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint256 availableLiquidity, uint256 totalPrincipalStableDebt, uint256 averageStableRate, uint256 stableDebtLastUpdateTimestamp, uint256 totalScaledVariableDebt, uint256 priceInMarketReferenceCurrency, address priceOracle, uint256 variableRateSlope1, uint256 variableRateSlope2, uint256 stableRateSlope1, uint256 stableRateSlope2, uint256 baseStableBorrowRate, uint256 baseVariableBorrowRate, uint256 optimalUsageRatio, bool isPaused, bool isSiloedBorrowing, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt, bool flashLoanEnabled, uint256 debtCeiling, uint256 debtCeilingDecimals, uint8 eModeCategoryId, uint256 borrowCap, uint256 supplyCap, uint256 eModeLtv, uint256 eModeLiquidationThreshold, uint256 eModeLiquidationBonus, address eModePriceSource, string eModeLabel, bool borrowableInIsolation)[] memory, tuple(uint256 marketReferenceCurrencyUnit, int256 marketReferenceCurrencyPriceInUsd, int256 networkBaseTokenPriceInUsd, uint8 networkBaseTokenPriceDecimals))"
];

async function main() {
    // Determine network name from --network flag
    let networkName = hre.network.name || 'sepolia';
    
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

    // Get the Aave addresses for the current network
    const aaveAddresses = AAVE_ADDRESSES[networkName];
    if (!aaveAddresses) {
        throw new Error(`Aave addresses not configured for network: ${networkName}`);
    }

    // Connect to the UiPoolDataProvider contract
    const uiDataProvider = new ethers.Contract(
        aaveAddresses.UI_POOL_DATA_PROVIDER,
        UI_POOL_DATA_PROVIDER_ABI,
        provider
    );

    console.log(`📡 Checking Aave V3 addresses on ${networkName}...\n`);

    try {
        const [reservesData] = await uiDataProvider.getReservesData(aaveAddresses.POOL_ADDRESSES_PROVIDER);

        console.log(`Found ${reservesData.length} reserves\n`);

        for (const reserve of reservesData) {
            const aTokenAddress = reserve.aTokenAddress;
            
            if (aTokenAddress && aTokenAddress !== ethers.ZeroAddress) {
                console.log(`✅ ${reserve.symbol} (${reserve.underlyingAsset}):`);
                console.log(`   aToken: ${aTokenAddress}`);
                console.log(`   Decimals: ${reserve.decimals}`);
                // Add other data points if needed:
                // console.log(`   Borrowing Enabled: ${reserve.borrowingEnabled}`);
            } else {
                console.log(`❌ ${reserve.symbol} (${reserve.underlyingAsset}): NO aToken address returned.`);
            }
            console.log(); // Blank line for readability
        }
    } catch (error) {
        console.error("❌ Error fetching reserves data:", error.message);
        process.exit(1);
    }
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Error:", error.message);
        process.exit(1);
    });