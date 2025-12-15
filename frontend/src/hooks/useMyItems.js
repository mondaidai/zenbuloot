import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/context/WalletContext";
import { useOmamoriNFT } from "@/hooks/useOmamoriNFT";
import { ethers } from "ethers";
import { ZENBULOOT_TX } from "@config/contracts";

export function useMyItems(batchSize = 2000) {
    const { address } = useWallet();
    const { contract, fetchToken } = useOmamoriNFT();

    const [tokens, setTokens] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [fromBlock, setFromBlock] = useState(0);
    const [latestBlock, setLatestBlock] = useState(0);
    const [oldestBlock, setOldestBlock] = useState(0);

    // --------------------------------------------------------
    // 1) Fetch latest block
    // --------------------------------------------------------
    const refreshLatestBlock = async () => {
        try {
            let provider = null;

            // Prefer injected provider in browser (MetaMask / wallet)
            if (typeof window !== "undefined" && window.ethereum) {
                provider = new ethers.BrowserProvider(window.ethereum);
            } else if (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_RPC) {
                // Fallback to RPC URL when running in non-browser env or when injected provider is absent
                provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC);
            } else {
                console.warn("No provider available to refresh latest block");
                return null;
            }

            const b = await provider.getBlockNumber();
            setLatestBlock(b);
            return b;
        } catch (err) {
            console.error("Failed to refresh latest block:", err);
            return null;
        }
    };

    useEffect(() => {
        const fetchLatest = async () => {
            if (!window.ethereum) return;
            try {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const latest = await provider.getBlockNumber();
                setLatestBlock(latest);
            } catch (err) {
                console.error("Failed to fetch latest block:", err);
            }
        };
        fetchLatest();
    }, []);

    // --------------------------------------------------------
    // 2) Fetch contract deployment block
    // --------------------------------------------------------
    useEffect(() => {
        const fetchOldestBlock = async () => {
            if (!window.ethereum || !ZENBULOOT_TX) return;

            try {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const receipt = await provider.getTransactionReceipt(ZENBULOOT_TX);

                if (receipt?.blockNumber) {
                    setOldestBlock(receipt.blockNumber);
                }
            } catch (err) {
                console.error("Failed to fetch ZenbuLoot deployment block:", err);
            }
        };

        fetchOldestBlock();
    }, []);

    // --------------------------------------------------------
    // 3) Compute safe automatic fromBlock AFTER both numbers known
    // --------------------------------------------------------
    useEffect(() => {
        if (!latestBlock || !oldestBlock) return;

        // Only auto-set once; do not override user slider or earlier manual changes
        setFromBlock(prev => {
            if (prev !== 0) return prev;

            const defaultWindow = latestBlock - 20000;
            const safeStart = Math.max(oldestBlock, defaultWindow);

            return safeStart;
        });
    }, [latestBlock, oldestBlock]);

    // --------------------------------------------------------
    // 4) Batch fetch owned tokens
    // --------------------------------------------------------
    const loadOwnedTokens = useCallback(
        async (startBlock = fromBlock, endBlock = latestBlock) => {
            if (!contract || !address) return;

            setLoading(true);
            setError(null);

            try {
                const owned = [];
                const sleep = (ms) => new Promise(res => setTimeout(res, ms));

                const baseFilter = contract.filters.Transfer(null, address);

                // Recursive range splitting (anti-provider-reject)
                const fetchLogsRange = async (from, to) => {
                    if (from > to) return [];

                    try {
                        return await contract.queryFilter(baseFilter, from, to);
                    } catch (err) {
                        console.warn(
                            `queryFilter failed for ${from}-${to}:`,
                            err?.message
                        );

                        if (to - from <= 50) return [];

                        const mid = Math.floor((from + to) / 2);
                        const left = await fetchLogsRange(from, mid);
                        await sleep(100);
                        const right = await fetchLogsRange(mid + 1, to);
                        return [...left, ...right];
                    }
                };

                let currentStart = startBlock;

                while (currentStart <= endBlock) {
                    const currentEnd = Math.min(currentStart + batchSize - 1, endBlock);
                    const logs = await fetchLogsRange(currentStart, currentEnd);

                    for (const evt of logs) {
                        const tokenId = evt?.args?.tokenId
                            ? Number(evt.args.tokenId)
                            : null;
                        if (tokenId === null) continue;

                        let owner;
                        try {
                            owner = await contract.ownerOf(tokenId);
                        } catch {
                            continue;
                        }

                        if (owner.toLowerCase() === address.toLowerCase()) {
                            const tokenData = await fetchToken(tokenId);
                            if (tokenData) owned.push(tokenData);
                        }
                    }

                    await sleep(50);
                    currentStart = currentEnd + 1;
                }

                setTokens(owned);
            } catch (err) {
                console.error("Failed loading tokens:", err);
                setError(err.message || "Failed to load items");
            } finally {
                setLoading(false);
            }
        },
        [contract, address, fetchToken, fromBlock, latestBlock, batchSize]
    );

    // --------------------------------------------------------
    // 5) Initial load
    // --------------------------------------------------------
    useEffect(() => {
        // Wait until fromBlock is set to a safe value
        if (contract && address && latestBlock > 0 && fromBlock > 0) {
            loadOwnedTokens();
        }
    }, [contract, address, latestBlock, fromBlock, loadOwnedTokens]);

    // --------------------------------------------------------
    // 6) Live events
    // --------------------------------------------------------
    useEffect(() => {
        if (!contract || !address) return;

        const lowered = address.toLowerCase();

        const triggerReload = () => loadOwnedTokens();

        const onMint = (tokenId, typeId, player) => {
            if (player.toLowerCase() === lowered) triggerReload();
        };

        const onTransfer = (from, to, tokenId) => {
            if (
                from.toLowerCase() === lowered ||
                to.toLowerCase() === lowered
            ) {
                triggerReload();
            }
        };

        contract.on("MintedItem", onMint);
        contract.on("TransferWithData", onTransfer);
        contract.on("ItemConsumed", triggerReload);
        contract.on("ItemBurned", triggerReload);

        return () => {
            contract.off("MintedItem", onMint);
            contract.off("TransferWithData", onTransfer);
            contract.off("ItemConsumed", triggerReload);
            contract.off("ItemBurned", triggerReload);
        };
    }, [contract, address, loadOwnedTokens]);

    // --------------------------------------------------------
    return {
        tokens,
        loading,
        error,
        loadOwnedTokens,
        fromBlock,
        setFromBlock,
        latestBlock,
        oldestBlock,
        refreshLatestBlock
    };
}
