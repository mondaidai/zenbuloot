// Centralized on-chain constants and contract addresses.
// These honor Vite env variables when provided (prefix VITE_). Example in .env:
// VITE_ZENIKANE_ADDRESS=0x...
// VITE_ZENBU_LOOT_ADDRESS=0x...
// VITE_ZKN_PRICE_WEI=50000000000000

// Token contract (Zenikane) address. Falls back to local testnet address.
export const ZENIKANE_ADDRESS = import.meta.env.VITE_ZENIKANE_ADDRESS;

// Optional sale contract (ZenbuLoot) that exposes a payable buyZKN() function.
// Leave empty or unset to disable the sale path in the UI.
export const ZENBU_LOOT_ADDRESS = import.meta.env.VITE_ZENBU_LOOT_ADDRESS;


export const OMAMORINFT_ADDRESS = import.meta.env.VITE_OMAMORINFT_ADDRESS;

// Optional on-chain game contract (PickAChance). Set VITE_PICK_A_CHANCE_ADDRESS to wire the page
export const GAME_ENGINE_ADDRESS = import.meta.env.VITE_GAME_ENGINE_ADDRESS;


export const VAULT_ADDRESS = import.meta.env.VITE_VAULT_ADDRESS;

export const ZENBULOOT_TX = import.meta.env.VITE_ZENBU_LOOT_TX;

// On-chain price per 1 ZKN in wei: default 5e13 = 0.00005 ETH
export const ZKN_PRICE_WEI = BigInt(String(import.meta.env.VITE_ZKN_PRICE_WEI || "50000000000000"));

// Export any other chain-specific constants here in the future.
