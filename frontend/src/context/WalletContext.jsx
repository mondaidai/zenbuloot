// context/WalletContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { ethers } from "ethers";
import { ZENBU_LOOT_ADDRESS } from "@/config/contracts";
import { chainIdToName } from "@utils/formatters";
import { useContracts } from "@/context/ContractsContext";

const WalletContext = createContext();

export function WalletProvider({ children }) {
  const { zknRef, getSigner } = useContracts();

  const [address, setAddress] = useState(null);
  const [network, setNetwork] = useState(null);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);

  /* ---------------------------------------------------
   * CONNECT WALLET (USER ACTION)
   * --------------------------------------------------- */
  const connectWallet = async () => {
    if (!window.ethereum) return;

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    if (!accounts.length) return;

    const wallet = accounts[0];
    setAddress(wallet);

    const chainIdHex = await window.ethereum.request({
      method: "eth_chainId",
    });

    const chainId = parseInt(chainIdHex, 16);

    setNetwork({ chainId, name: chainIdToName(chainId) });
    setConnected(true);
    setReady(true);

    // 🔥 persist session across reloads
    localStorage.setItem("walletConnected", "1");
  };

  /* ---------------------------------------------------
   * DISCONNECT WALLET (MANUAL)
   * --------------------------------------------------- */
  const disconnectWallet = () => {
    setAddress(null);
    setNetwork(null);
    setConnected(false);
    setReady(false);

    // 🔥 remove persistence
    localStorage.removeItem("walletConnected");
  };

  /* ---------------------------------------------------
   * REQUEST ZKN APPROVAL
   * --------------------------------------------------- */
  const requestZKNApproval = async () => {
    if (!address) throw new Error("Wallet not connected");

    try {
      const signer = await getSigner();
      if (!signer) throw new Error("No signer");

      const zknWithSigner = zknRef.current.connect(signer);
      const allowance = await zknWithSigner.allowance(address, ZENBU_LOOT_ADDRESS);

      if (allowance === 0n) {
        const tx = await zknWithSigner.approve(
          ZENBU_LOOT_ADDRESS,
          ethers.MaxUint256
        );
        await tx.wait();
      }
    } catch (err) {
      console.error("ZKN approval error:", err);
      throw err;
    }
  };

  /* ---------------------------------------------------
   * AUTO-RESTORE CONNECTION ON PAGE RELOAD
   * --------------------------------------------------- */
  useEffect(() => {
    if (!window.ethereum) return;

    const autoRestore = async () => {
      const wasConnected = localStorage.getItem("walletConnected") === "1";
      if (!wasConnected) {
        setReady(true); // avoid flicker by marking ready early
        return;
      }

      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });

      if (accounts.length === 0) {
        localStorage.removeItem("walletConnected");
        setReady(true);
        return;
      }

      const wallet = accounts[0];
      setAddress(wallet);

      const chainIdHex = await window.ethereum.request({
        method: "eth_chainId",
      });

      const chainId = parseInt(chainIdHex, 16);

      setNetwork({ chainId, name: chainIdToName(chainId) });
      setConnected(true);
      setReady(true);
    };

    autoRestore();
  }, []);

  /* ---------------------------------------------------
   * ACCOUNT & CHAIN CHANGE HANDLERS
   * --------------------------------------------------- */
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        setAddress(accounts[0]);
        setConnected(true);
        setReady(true);
        localStorage.setItem("walletConnected", "1");
      }
    };

    const handleChainChanged = (chainIdHex) => {
      const chainId = parseInt(chainIdHex, 16);
      setNetwork({ chainId, name: chainIdToName(chainId) });
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  /* ---------------------------------------------------
   * CONTEXT VALUE
   * --------------------------------------------------- */
  return (
    <WalletContext.Provider
      value={{
        address,
        network,
        connected,
        ready,
        connectWallet,
        disconnectWallet,
        requestZKNApproval,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
