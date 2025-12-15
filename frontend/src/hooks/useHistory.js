import { useEffect, useState, useCallback } from "react";
import { useInvestments } from "@hooks/useInvestments";
import { useContractSettings } from "@hooks/useContractSettings";
import { useContracts } from "@context/ContractsContext";
import { useOmamoriNFT } from "@hooks/useOmamoriNFT";
import { ethers } from "ethers";

export const useHistory = () => {
  const { getZKNLocks, getETHLocks, getExpectedProfit, feeSettings } = useInvestments();
  const { decimals } = useContractSettings();
  const { lootRef, vaultRef, getContractWithSigner } = useContracts();
  const { fetchToken } = useOmamoriNFT();

  const [reinvestDuration, setReinvestDuration] = useState(30 * 24 * 60 * 60);
  const [locks, setLocks] = useState([]);
  const [selectedZKN, setSelectedZKN] = useState(new Set());
  const [selectedETH, setSelectedETH] = useState(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [showEthModal, setShowEthModal] = useState(false);
  const [ethAction, setEthAction] = useState(null);
  const [modalError, setModalError] = useState("");

  // Profit calculation state
  const [expectedProfit, setExpectedProfit] = useState(null);
  const [loadingProfit, setLoadingProfit] = useState(false);

  // Token/item type state
  const [tokenInfo, setTokenInfo] = useState(null);
  const [loadingToken, setLoadingToken] = useState(false);

  // Utilities
  const parseTokenId = (lockId) => lockId.split("-")[1];

  const hasLockEnded = (lockEnd) =>
    lockEnd && Number(lockEnd) <= Math.floor(Date.now() / 1000);

  const getTotalSelectedETHAmount = useCallback(() => {
    let total = 0n;
    locks.forEach((lock) => {
      lock.eth.forEach((ethLock) => {
        if (selectedETH.has(ethLock.lockId)) {
          total += ethLock.amount;
        }
      });
    });
    return total;
  }, [locks, selectedETH]);

  const getTokenIdFromSelectedLocks = useCallback(() => {
    if (selectedETH.size === 0) return null;
    const firstLockId = Array.from(selectedETH)[0];
    const tokenId = parseTokenId(firstLockId);
    return Number(tokenId);
  }, [selectedETH]);

  const exceedsMaxInvestment = useCallback(() => {
    if (!tokenInfo || !tokenInfo.itemType) return false;
    const totalETH = getTotalSelectedETHAmount();
    const maxInvestmentWei = ethers.parseEther(tokenInfo.itemType.maxInvestment);
    return totalETH > maxInvestmentWei;
  }, [tokenInfo, getTotalSelectedETHAmount]);

  // Fetch token info when ETH locks are selected and modal opens
  useEffect(() => {
    const fetchSelectedToken = async () => {
      if (!showEthModal || selectedETH.size === 0) {
        setTokenInfo(null);
        return;
      }

      try {
        setLoadingToken(true);
        const tokenId = getTokenIdFromSelectedLocks();

        if (tokenId) {
          const tokenData = await fetchToken(tokenId);
          if (tokenData && tokenData.itemType) {
            setTokenInfo(tokenData);
            setReinvestDuration(tokenData.itemType.minLockDuration);
          }
        }
      } catch (err) {
        console.error("Failed to fetch token:", err);
        setTokenInfo(null);
      } finally {
        setLoadingToken(false);
      }
    };

    fetchSelectedToken();
  }, [showEthModal, selectedETH, getTokenIdFromSelectedLocks, fetchToken]);

  // Fetch locks
  const fetchLocks = useCallback(async () => {
    try {
      setIsLoading(true);

      const zknLocks = await getZKNLocks();
      const ethLocks = await getETHLocks();

      const combined = {};

      zknLocks.forEach((lock, index) => {
        const tid = Number(lock.tokenId);
        if (!combined[tid]) combined[tid] = { tokenId: tid, zkn: [], eth: [] };
        combined[tid].zkn.push({
          lockId: `zkn-${tid}-${index}`,
          amount: lock.amount,
          lockEnd: lock.lockEnd,
          claimed: lock.claimed,
          contractIndex: index,
          tokenId: tid,
        });
      });

      ethLocks.forEach((lock, index) => {
        const tid = Number(lock.tokenId);
        if (!combined[tid]) combined[tid] = { tokenId: tid, zkn: [], eth: [] };
        combined[tid].eth.push({
          lockId: `eth-${tid}-${index}`,
          amount: lock.amount,
          lockEnd: lock.lockEnd,
          claimed: lock.claimed,
          contractIndex: index,
          tokenId: tid,
        });
      });

      setLocks(Object.values(combined));
    } catch (err) {
      console.error("Failed to fetch locks:", err);
    } finally {
      setIsLoading(false);
    }
  }, [getZKNLocks, getETHLocks]);

  useEffect(() => {
    fetchLocks();
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Profit calculation effect
  useEffect(() => {
    const calculateProfit = async () => {
      if (ethAction !== "reinvest" || selectedETH.size === 0 || !tokenInfo) {
        setExpectedProfit(null);
        return;
      }

      try {
        setLoadingProfit(true);

        const totalETH = getTotalSelectedETHAmount();

        if (totalETH === 0n) {
          setExpectedProfit(null);
          return;
        }

        if (exceedsMaxInvestment()) {
          setExpectedProfit(null);
          return;
        }

        const profit = await getExpectedProfit(
          totalETH,
          reinvestDuration,
          tokenInfo.itemType.apr,
          tokenInfo.itemType.strategyId
        );

        if (!feeSettings) {
          setExpectedProfit(profit);
          return;
        }

        const feeRate = BigInt(feeSettings.performanceFee);
        const base = 10000n;
        const performanceFee = profit * feeRate / base;

        setExpectedProfit(profit - performanceFee);
      } catch (err) {
        console.error("Failed to calculate profit:", err);
        setExpectedProfit(null);
      } finally {
        setLoadingProfit(false);
      }
    };

    calculateProfit();
  }, [ethAction, selectedETH, reinvestDuration, getTotalSelectedETHAmount, tokenInfo, exceedsMaxInvestment, getExpectedProfit, feeSettings]);

  // Selection logic
  const handleLockSelect = (lockId, type) => {
    if (type === "ZKN") {
      setSelectedZKN((prev) => {
        const s = new Set(prev);
        s.has(lockId) ? s.delete(lockId) : s.add(lockId);
        return s;
      });
      return;
    }

    const newTokenId = parseTokenId(lockId);

    setSelectedETH((prev) => {
      const s = new Set(prev);

      if (s.has(lockId)) {
        s.delete(lockId);
        return s;
      }

      if (s.size === 0) {
        s.add(lockId);
        return s;
      }

      const existingTokenId = parseTokenId(Array.from(s)[0]);

      if (existingTokenId !== newTokenId) {
        return new Set([lockId]);
      }

      s.add(lockId);
      return s;
    });
  };

  const handleSelectAll = (type) => {
    if (type === "ZKN") {
      const all = [];
      locks.forEach((l) =>
        l.zkn.forEach((z) => {
          if (hasLockEnded(z.lockEnd) && !z.claimed) all.push(z.lockId);
        })
      );
      setSelectedZKN(new Set(all));
      return;
    }

    const selected = Array.from(selectedETH);
    const selectedTokenId = selected.length ? parseTokenId(selected[0]) : null;

    const ethByToken = {};
    locks.forEach((l) =>
      l.eth.forEach((e) => {
        if (hasLockEnded(e.lockEnd) && !e.claimed) {
          if (!ethByToken[e.tokenId]) ethByToken[e.tokenId] = [];
          ethByToken[e.tokenId].push(e.lockId);
        }
      })
    );

    if (!selectedTokenId) {
      const firstTokenId = Object.keys(ethByToken)[0];
      if (!firstTokenId) return setSelectedETH(new Set());
      setSelectedETH(new Set(ethByToken[firstTokenId]));
      return;
    }

    const group = ethByToken[selectedTokenId] || [];

    if (group.every((id) => selectedETH.has(id))) {
      setSelectedETH(new Set());
    } else {
      setSelectedETH(new Set(group));
    }
  };

  const handleClearSelection = () => {
    setSelectedZKN(new Set());
    setSelectedETH(new Set());
  };

  // Process logic
  const handleProcess = async (type, mode) => {
    const selected = mode === "reinvest" ? selectedETH : (type === "ZKN" ? selectedZKN : selectedETH);
    const ids = Array.from(selected);
    if (!ids.length) return;

    const contract = await getContractWithSigner(
      mode === "reinvest" ? lootRef : (type === "ZKN" ? lootRef : vaultRef)
    );

    const indexes = ids.map((id) => Number(id.split("-")[2]));

    try {
      setIsProcessing(true);

      console.log("Processing:", type, mode, "indexes:", indexes);
      if (type === "ZKN") {
        if (mode === "reinvest") {
          await contract.reInvestETH(indexes, reinvestDuration);
        } else if (mode === "processQueue") {
          await contract.processQueue(1);
        } else {
          await contract.unlockZKN(indexes);
        }
      } else {
        if (mode === "deposit") {
          await contract.withdrawETH(indexes, true);
        } else {
          await contract.withdrawETH(indexes, false);
        }
      }

      await fetchLocks();
      handleClearSelection();
    } catch (err) {
      console.error("PROCESS FAILED:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Counts
  const getAvailableLocksCount = (type) =>
    locks.reduce(
      (sum, lock) =>
        sum +
        lock[type.toLowerCase()].filter(
          (l) => hasLockEnded(l.lockEnd) && !l.claimed
        ).length,
      0
    );

  const getMaxLockCount = (lock) => Math.max(lock.zkn.length, lock.eth.length);

  const hasAnySelection = selectedZKN.size > 0 || selectedETH.size > 0;

  const hasAnyAvailable =
    getAvailableLocksCount("ZKN") > 0 ||
    getAvailableLocksCount("ETH") > 0;

  return {
    // State
    reinvestDuration,
    setReinvestDuration,
    locks,
    selectedZKN,
    selectedETH,
    isProcessing,
    isLoading,
    showEthModal,
    setShowEthModal,
    ethAction,
    setEthAction,
    modalError,
    setModalError,
    expectedProfit,
    loadingProfit,
    tokenInfo,
    loadingToken,
    decimals,
    // Methods
    fetchLocks,
    handleLockSelect,
    handleSelectAll,
    handleClearSelection,
    handleProcess,
    getAvailableLocksCount,
    getMaxLockCount,
    getTotalSelectedETHAmount,
    hasLockEnded,
    exceedsMaxInvestment,
    hasAnySelection,
    hasAnyAvailable,
  };
};
