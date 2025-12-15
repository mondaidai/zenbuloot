import { useState, useEffect } from "react";
import { ethers } from "ethers";
import ZenikaneABI from "@contracts/Zenikane.json";
import { ZENIKANE_ADDRESS } from "@/config/contracts";

export function useWalletBalance() {
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!window.ethereum) {
        setLoading(false);
        return;
      }

      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        const acct = accounts[0] || null;

        if (!mounted) return;
        setAccount(acct);

        if (!acct) {
          setLoading(false);
          return;
        }

        const provider = new ethers.BrowserProvider(window.ethereum);

        // Try token balance
        try {
          const token = new ethers.Contract(ZENIKANE_ADDRESS, ZenikaneABI, provider);
          const bal = await token.balanceOf(acct);
          const dec = await token.decimals();
          setBalance(Number(ethers.formatUnits(bal, dec)));
          setLoading(false);
          return;
        } catch {}

        // Fallback ETH balance
        const eth = await provider.getBalance(acct);
        setBalance(Number(ethers.formatEther(eth)));
        setLoading(false);

      } catch {
        setLoading(false);
      }
    };

    load();
    return () => (mounted = false);
  }, []);

  const connect = async () => {
    if (!window.ethereum) return;
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    setAccount(accounts[0] || null);
  };

  return {
    account,
    balance,
    loading,
    connect,
    setBalance // allow local UI updates
  };
}
