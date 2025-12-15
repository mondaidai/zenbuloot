import { useWallet } from "@/context/WalletContext";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import { useContracts } from "@context/ContractsContext";
import { useContractBalance } from "@context/BalanceContext";

export function useInvestments() {
    const { address } = useWallet();
    const { vaultRef, lootRef, getSigner } = useContracts();
    const { availableEthInVault } = useContractBalance();
    const [feeSettings, setFeeSettings] = useState(null);

    // Fetch fee settings once on mount
    useEffect(() => {
        const fetchFeeSettings = async () => {
            try {
                if (!lootRef?.current) {
                    console.warn("ZenbuLoot contract not available");
                    return;
                }

                const settings = await lootRef.current.fees();
                setFeeSettings({
                    nftPurchaseFee: Number(settings.nftPurchaseFee),
                    zknBuyFee: Number(settings.zknBuyFee),
                    zknSellFee: Number(settings.zknSellFee),
                    gameFee: Number(settings.gameFee),
                    performanceFee: Number(settings.performanceFee)
                });
            } catch (err) {
                console.warn("Failed to fetch fee settings:", err);
            }
        };

        fetchFeeSettings();
    }, [lootRef]);

    const getETHLocks = async () => {
        if (!window.ethereum) return [];
        if (!address) return [];

        try {
            const lockLength = await vaultRef.current.getLockLength(address);
            return await vaultRef.current.getLocksRange(address, 0, lockLength);
        } catch (err) {
            console.warn("Failed fetching ETH locks:", err);
            return [];
        }
    };

    const getZKNLocks = async () => {
        if (!window.ethereum) return [];
        if (!address) return [];

        try {
            const lockLength = await lootRef.current.getLockLength(address);
            return await lootRef.current.getLocksRange(address, 0, lockLength);
        } catch (err) {
            console.warn("Failed fetching ZKN locks:", err);
            return [];
        }
    };


    const getInvestmentsForToken = async (tokenId) => {
        const ethLocks = await getETHLocks();
        const zknLocks = await getZKNLocks();

        const ethInvestments = ethLocks
            .filter(lock => lock.tokenId === BigInt(tokenId))
            .map(lock => ({
                ...lock,
                source: "ETH",
                amount: lock.amount ?? 0n,
                claimed: lock.claimed ?? false,
            }));

        const zknInvestments = zknLocks
            .filter(lock => lock.tokenId === BigInt(tokenId))
            .map(lock => ({
                ...lock,
                source: "ZKN",
                amount: lock.amount ?? 0n,
                claimed: lock.claimed ?? false,
            }));
        return { ethInvestments, zknInvestments };
    };
    /**
     * 
     * @param {*} item 
     * @param {bigint | number} lockDuration 
     * @param {bigint | number} ethAmountWei 
     * @param { bool } useDeposit 
     */
    const handleInvest = async (item, lockDuration, ethAmountWei, useDeposit = true) => {
        if (!window.ethereum) {
            toast.warn("Ethereum provider not found");
            return;
        }
        if (!item) {
            toast.warn("No item selected for investment");
            return;
        }
        if (lockDuration < item.minLockDuration || lockDuration > item.maxLockDuration) {
            toast.warn(`Lock duration must be between ${item.minLockDuration} and ${item.maxLockDuration} seconds.`);
            return;
        }
        if (useDeposit === true) {
            ethAmountWei -= availableEthInVault;
        }
        if (ethAmountWei < item.minInvestment) {
            toast.warn(`Investment amount must be at least ${item.minInvestment} ETH.`);
            return;
        }

        try {
            const signer = await getSigner();
            if (!signer || !lootRef) return null;
            const contract = lootRef.current.connect(signer);
            const tx = await contract.investETH(item.tokenId, lockDuration, ethAmountWei, { value: ethAmountWei });
            await tx.wait();
            toast.success("Investment successful!");
        } catch (err) {
            console.warn("Investment failed:", err);
        }
    };

    /**  
     * @param {bigint | number} amountETHWei     Amount of ETH in wei.
     * @param {bigint | number} lockDuration     Lock duration in seconds.
     * @param {bigint | number} apr              APR value.
     * @param {bigint | number} strategyId       Strategy ID.
     * @returns {Promise<bigint>} Expected profit in ZKN (before fees).
     */
    const getExpectedProfit = async (amountETHWei, lockDuration, apr, strategyId) => {
        try {
            if (!lootRef || !lootRef.current) {
                console.warn("ZenbuLoot contract not available");
                return 0n;
            }
            return await lootRef.current.calculateZKNPotentialProfit(amountETHWei, lockDuration, apr, strategyId);
        } catch (err) {
            console.warn("Failed to calculate expected profit:", err);
            return 0n;
        }
    };

    return {
        getETHLocks,
        getZKNLocks,
        getInvestmentsForToken,
        handleInvest,
        getExpectedProfit,
        feeSettings,
    };
}
