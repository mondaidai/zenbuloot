/**
 * Custom Hardhat Configuration
 * This file is imported by both hardhat.config.ts and deployment scripts
 * to ensure configuration is consistent across the project
 */

export const hardhatCustomConfig = {
    aaveConfig: {
      localhost: {
        pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
        aWETH: "0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8",
        weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      },
      sepolia: {
        pool: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951",
        aWETH: "0x5b071b590a59395fE4025A0Ccc1FcC931AAc1830",
        weth: "0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c",
      },
      mainnet: {
        pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
        aWETH: "0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8",
        weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      },
    },
    contractNames: {
      ZENBU_LOOT: "ZenbuLoot",
      ZENIKANE: "Zenikane",
      OMAMORI_NFT: "OmamoriNFT",
      GAME_ENGINE: "GameEngine",
      AAVE_STRATEGY: "AaveStrategy",
      VAULT: "Vault",
    },
};
