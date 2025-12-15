// formatters.js
import { ethers } from "ethers";

export function formatEthAddress(address) {
  if (typeof address !== "string") {
    return "";
  }
  const isValidEtherumAddress = /^0x[A-Fa-f0-9]{40}$/.test(address);
  if (!isValidEtherumAddress) {
    return "";
  }

  const first = address.slice(0, 7);
  const last = address.slice(-5);

  return `${first}...${last}`;
}
export function chainIdToName(chainId) {
  switch (chainId) {
    case 1: return "Ethereum Mainnet";
    case 5: return "Goerli Testnet";
    case 10: return "Optimism";
    case 137: return "Polygon";
    case 11155111: return "Ethereum Sepolia";
    default: return "Chain Id: " + String(chainId);
  }
}

// Pure utility functions that accept balance as parameter
export function formatZKNBalance(balance, decimals = 18, formatDecimals = 4) {
  try {
    if (!balance) return "0.0000";
    const formatted = ethers.formatUnits(balance, decimals);
    return Number(formatted).toFixed(formatDecimals);
  } catch (err) {
    console.warn("Error formatting ZKN balance:", err);
    return "0.0000";
  }
}

export function formatETHBalance(ethBalance, formatDecimals = 4) {
  try {
    if (!ethBalance) return "0.0000";
    const formatted = ethers.formatEther(ethBalance);
    return Number(formatted).toFixed(formatDecimals);
  } catch (err) {
    console.warn("Error formatting ETH balance:", err);
    return "0.0000";
  }
}