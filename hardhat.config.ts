import * as dotenv from "dotenv";
dotenv.config();
import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";
import { hardhatCustomConfig } from "./config/hardhat-custom-config.mjs";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
    },
  },

  networks: {
    // localhost: When using "hardhat node" to run a local dev server
    // Run: npx hardhat node (in one terminal)
    // Then: npx hardhat run scripts/deployAppContracts.mjs --network localhost (in another)
    // This connects to http://127.0.0.1:8545 which is the running hardhat node
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
      accounts: ["0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"],
    },
    
    hardhat: {
      type: "edr-simulated",
      forking: {
        enabled: true,
        url: configVariable("MAINNET_RPC_URL"),
        blockNumber: 21000000,
      },
    },

    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },

    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },

    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },

    // Add mainnet configuration
    mainnet: {
      type: "http",
      chainType: "l1",
      url: configVariable("MAINNET_RPC_URL"),
      accounts: [configVariable("MAINNET_PRIVATE_KEY")],
    },
  },

  custom: hardhatCustomConfig,
});