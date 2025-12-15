// context/BalanceContext.jsx
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useContracts } from "@/context/ContractsContext";

const ContractBalanceContext = createContext();
export const useContractBalance = () => useContext(ContractBalanceContext);

export const ContractBalanceProvider = ({ children, address, connected }) => {
  const { lootRef, vaultRef, zknRef, providerRef, ready } = useContracts();

  const [balance, setBalance] = useState(0n);
  const [availableZkn, setAvailableZkn] = useState(0n);
  const [ethBalance, setEthBalance] = useState(0n);
  const [availableEthInVault, setAvailableEthInVault] = useState(0n);
  const [lockedZknBalance, setLockedZknBalance] = useState(0n);
  const [lockedEthBalance, setLockedEthBalance] = useState(0n);
  const [decimals, setDecimals] = useState(18);

  const isMounted = useRef(false);

  /** -------------------- Fetch Functions -------------------- */
  const fetchZKNBalance = useCallback(async (addr = address) => {
    if (!ready || !addr || !isMounted.current) return;
    if (!lootRef.current || !zknRef.current) return;

    try {
      const [bal, available, tokenDecimals] = await Promise.all([
        zknRef.current.balanceOf(addr),
        lootRef.current.getAvailableZKN(addr),
        zknRef.current.decimals(),
      ]);

      if (!isMounted.current) return;
      setBalance(bal);
      setAvailableZkn(available);
      setDecimals(Number(tokenDecimals));
    } catch (err) {
      console.warn("Failed to fetch ZKN balance:", err);
    }
  }, [address, ready, lootRef, zknRef]);

  const fetchETHBalance = useCallback(async (addr = address) => {
    if (!ready || !addr || !isMounted.current) return;
    if (!providerRef.current) return;

    try {
      const bal = await providerRef.current.getBalance(addr);
      if (isMounted.current) setEthBalance(bal);
    } catch (err) {
      console.warn("Failed to fetch ETH balance:", err);
    }
  }, [address, ready, providerRef]);

  const fetchLockedBalances = useCallback(async (addr = address) => {
    if (!ready || !addr || !isMounted.current) return;
    if (!vaultRef.current || !lootRef.current) return;

    try {
      const [ethLocked, zknLocked] = await Promise.all([
        vaultRef.current.totalLockedETH(addr),
        lootRef.current.userTotalZKNLocked(addr),
      ]);

      if (!isMounted.current) return;
      setLockedEthBalance(ethLocked);
      setLockedZknBalance(zknLocked);
    } catch (err) {
      console.warn("Failed to fetch locked balances:", err);
    }
  }, [address, ready, lootRef, vaultRef]);

  const fetchAvailableEthInVault = useCallback(async (addr = address) => {
    if (!ready || !addr || !isMounted.current) return;
    if (!vaultRef.current) return;

    try {
      const available = await vaultRef.current.getAvailableETH(addr);
      if (isMounted.current) setAvailableEthInVault(available);
    } catch (err) {
      console.warn("Failed to fetch available ETH in vault:", err);
    }
  }, [address, ready, vaultRef]);

  const fetchAll = useCallback(async () => {
    await Promise.all([
      fetchZKNBalance(),
      fetchETHBalance(),
      fetchLockedBalances(),
      fetchAvailableEthInVault(),
    ]);
  }, [fetchZKNBalance, fetchETHBalance, fetchLockedBalances, fetchAvailableEthInVault]);

  /** -------------------- Event Listeners -------------------- */
  const setupEventListeners = useCallback(() => {
    if (!ready || !window.ethereum || !address || !connected || !isMounted.current) return;

    // ZKN Transfer
    const transferHandler = (from, to) => {
      if (!isMounted.current) return;

      if ([from?.toLowerCase(), to?.toLowerCase()].includes(address.toLowerCase())) {
        fetchZKNBalance();
      }
    };

    zknRef.current?.on("Transfer", transferHandler);

    // Loot events
    const lootEvents = [
      "ZKNSold",
      "ZKNBought",
      "OmamoriNFTPurchased",
      "FeeCollected",
      "ZKNUnlocked",
      "ZKNLocked",
      "ProfitsWithdrawn",
    ];

    const lootHandler = (...args) => {
      if (!isMounted.current) return;

      const event = args[args.length - 1];
      const affected = Object.values(event?.args ?? {}).some(
        (v) => v?.toString?.().toLowerCase() === address.toLowerCase()
      );

      if (affected) {
        fetchAll();
      }
    };

    lootEvents.forEach((ev) => lootRef.current?.on(ev, lootHandler));

    return () => {
      zknRef.current?.off("Transfer", transferHandler);
      lootEvents.forEach((ev) => lootRef.current?.off(ev, lootHandler));
    };
  }, [ready, address, connected, lootRef, zknRef, fetchZKNBalance, fetchAll]);

  /** -------------------- Initialize -------------------- */
  useEffect(() => {
    isMounted.current = true;
    let cleanupListeners = null;

    const init = async () => {
      if (!ready || !address || !connected) return;

      await fetchAll();
      cleanupListeners = setupEventListeners();
    };

    init();

    return () => {
      isMounted.current = false;
      cleanupListeners?.();

      try {
        zknRef.current?.removeAllListeners?.();
        lootRef.current?.removeAllListeners?.();
        vaultRef.current?.removeAllListeners?.();
      } catch {}
    };
  }, [ready, address, connected, fetchAll, setupEventListeners]);

  return (
    <ContractBalanceContext.Provider
      value={{
        balance,
        ethBalance,
        decimals,
        lockedEthBalance,
        lockedZknBalance,
        availableEthInVault,
        availableZkn,
        refreshBalances: fetchAll,
      }}
    >
      {children}
    </ContractBalanceContext.Provider>
  );
};
