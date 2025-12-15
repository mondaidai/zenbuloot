import { useContractBalance } from "@context/BalanceContext";

export const useConstants = () => {
    const { decimals } = useContractBalance();

    // Use JavaScript BigInt
    const HOUSE_EDGE = 100;    // 1%
    const MIN_BET = 1n; // 0.0001 ZKN
    const BET_STEP = 1;
    const MIN_CHANCE = HOUSE_EDGE+1;       // 1.01%
    const MAX_CHANCE = 9999;    // 99.99%
    const PRECISION = 10000;   // 00.00
    const CHANCE_STEP = 1;      // 0.01%
    return {
        HOUSE_EDGE,
        PRECISION,
        MIN_BET,
        BET_STEP,
        MIN_CHANCE,
        MAX_CHANCE,
        CHANCE_STEP
    };
};