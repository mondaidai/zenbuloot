// components/ItemShop.jsx
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { toast } from "react-toastify";

import { useWallet } from "@context/WalletContext";
import { useContractBalance } from "@context/BalanceContext";
import { useOmamoriNFT } from "@hooks/useOmamoriNFT";
import { useContractSettings } from "@hooks/useContractSettings";
import { useContracts } from "@context/ContractsContext";

import ZenikaneABI from "@contracts/Zenikane.json";
import ZenbuLootABI from "@contracts/ZenbuLoot.json";
import { ZENBU_LOOT_ADDRESS, ZENIKANE_ADDRESS } from "@/config/contracts";
import { ExchangeModal } from "@components/Shop/ExchangeModal";
import { ItemCard } from "@components/Shop/ItemCard";
import { QuickActions } from "@components/Shop/QuickActions";
import { ShopLoadingState, ShopErrorState, EmptyShopState } from "@components/Shop/ShopLoadingState";
import { BuyNFTModal } from "@components/Shop/BuyNFTModal";
import "@styles/item-shop.css";

export function ItemShop() {
  const { address, connectWallet, connected, requestZKNApproval } = useWallet();
  const { balance, ethBalance, availableZkn, refreshBalances, decimals: tokenDecimals } = useContractBalance();
  const { fetchAvailableItemTypes, loading: itemsLoading, error: itemsError } = useOmamoriNFT();
  const { getSigner, providerRef, zknRef, lootRef } = useContracts();
  const { price } = useContractSettings();

  const [items, setItems] = useState([]);
  // sale info removed — use settings/hooks directly (price from useContractSettings,
  // zknRef from useContracts, and decimals from useContractBalance)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [isProcessing, setProcessing] = useState(false);
  const [isOpeningModal, setIsOpeningModal] = useState(false);

  // Buy NFT modal
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const openBuyNFTModal = (item) => {
    if (!connected) {
      toast.info("Please connect wallet first");
      return;
    }
    setSelectedItem(item);
    setBuyModalOpen(true);
  };
  const closeBuyNFTModal = () => {
    setSelectedItem(null);
    setBuyModalOpen(false);
  };

  // ---------------- Fetch Items ----------------
  useEffect(() => {
    const loadItems = async () => {
      try {
        const availableItems = await fetchAvailableItemTypes();
        setItems(availableItems);
      } catch (err) {
        console.error("Failed to load shop items:", err);
        toast.error("Failed to load shop items");
      }
    };

    loadItems();
  }, [fetchAvailableItemTypes]);

  // ---------------- Refresh when user returns ----------------
  // If user switches tabs or navigates away then comes back, refresh balances and item list
  useEffect(() => {
    const handleVisible = async () => {
      try {
        if (typeof refreshBalances === "function") await refreshBalances();
        await fetchAvailableItemTypes();
      } catch (err) {
        console.warn("Failed to refresh on visibility/focus:", err);
      }
    };

    const onFocus = () => handleVisible();
    const onVisibility = () => {
      if (document.visibilityState === "visible") handleVisible();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshBalances, fetchAvailableItemTypes]);

  // (removed sale info state/effect — components should read price, zknRef, and decimals directly)

  // ---------------- Modal Handling ----------------
  const openModal = async (type) => {
    if (!connected) {
      toast.info("Please connect your wallet first");
      return;
    }
    // Show opening indicator while we refresh balances and prepare modal
    setIsOpeningModal(true);
    try {
      if (typeof refreshBalances === "function") {
        await refreshBalances();
      }
      setModalType(type);
      setModalOpen(true);
    } catch (err) {
      console.warn("Could not refresh balances before opening modal:", err);
      toast.warn("Failed to prepare exchange modal");
    } finally {
      setIsOpeningModal(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalType(null);
  };

  // ---------------- Ensure Wallet + Approve (Sell Only) ----------------
  const ensureWallet = async (zknAmountWei) => {
    if (!address) {
      await connectWallet();
      if (!address) return null;
    }
    const signer = await getSigner();
    if (!signer) throw new Error("Signer not available");

    const walletAddress = await signer.getAddress();

    if (modalType === "sell") {
      // WalletContext.requestZKNApproval uses the global zknRef internally,
      // so we can call it directly without passing the contract reference.
      await requestZKNApproval(zknAmountWei);
    }

    return { signer, walletAddress };
  };

  // ---------------- Confirm Buy/Sell ZKN ----------------
  const handleConfirmExchange = async (modalValue, type) => {
    if (!connected) return toast.error("Wallet not connected");
    setProcessing(true);

    try {
      const signer = await getSigner();
      const sale = lootRef.current?.connect(signer) || new ethers.Contract(ZENBU_LOOT_ADDRESS, ZenbuLootABI.abi, signer);

      if (type === "buy") {
        const ethValue = ethers.parseEther(modalValue.eth.toString());
        const tx = await sale.buyZKN({ value: ethValue });
        await tx.wait();
        toast.success(`Bought ${modalValue.zkn} ZKN`);
      }

      if (type === "sell") {
        const zknAmountWei = ethers.parseUnits(modalValue.zkn, tokenDecimals);
        const { signer: s, walletAddress } = await ensureWallet(zknAmountWei);

        const zknContract = zknRef.current.connect(s);
        const onChainBalance = await zknContract.balanceOf(walletAddress);

        // Debug logging to help understand balance mismatch issues
        try {
          console.debug("Sell debug:", {
            walletAddress,
            onChainBalance: onChainBalance.toString ? onChainBalance.toString() : String(onChainBalance),
            zknAmountWei: zknAmountWei.toString ? zknAmountWei.toString() : String(zknAmountWei),
            decimals: tokenDecimals,
          });
        } catch (e) {
          console.debug("Sell debug fallback:", walletAddress, String(onChainBalance), String(zknAmountWei), tokenDecimals);
        }

        // Ensure both values are BigInt before comparison (ethers v6 returns bigint)
        const balBig = typeof onChainBalance === "bigint" ? onChainBalance : BigInt(onChainBalance.toString());
        const wantBig = typeof zknAmountWei === "bigint" ? zknAmountWei : BigInt(zknAmountWei.toString());

        if (balBig < wantBig) {
          setProcessing(false);
          // Provide more context in toast to help user
          toast.error("Insufficient ZKN balance to sell. Check wallet/address/network and token decimals.");
          return;
        }

        const tx = await sale.sellZKN(zknAmountWei);
        const receipt = await tx.wait();
        
        // Check if AppendedToQueue event was emitted (queued transaction)
        const queuedEvent = receipt.logs.some(log => {
          try {
            const parsed = sale.interface.parseLog(log);
            return parsed?.name === "AppendedToQueue";
          } catch {
            return false;
          }
        });
        
        if (queuedEvent) {
          toast.warning(
            `Insufficient contract liquidity. Your ${modalValue.zkn} ZKN has been queued for processing. You'll receive ETH once liquidity is available (up to 7 days).`,
            { autoClose: 5000 }
          );
        } else {
          toast.success(`Sold ${modalValue.zkn} ZKN`);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err.reason || err.message || "Transaction failed");
    }

    setProcessing(false);
    closeModal();
  };

  // ---------------- Buy NFT ----------------
  const handleBuyItem = async (item, lockDurationSec, totalEth) => {
    if (!connected) return toast.info("Please connect wallet");
    setProcessing(true);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = lootRef.current?.connect(signer) || new ethers.Contract(ZENBU_LOOT_ADDRESS, ZenbuLootABI.abi, signer);
      const ethValue = ethers.parseEther(totalEth.toString());
      console.log("eth: ", ethValue);
      const tx = await contract.buyAndInvestOmamoriNFT(item.typeId, lockDurationSec, { value: ethValue });
      await tx.wait();
      toast.success(`Purchased ${item.name}`);

      const updated = await fetchAvailableItemTypes();
      setItems(updated);
    } catch (err) {
      console.error(err);
      toast.error(err.reason || err.message || "Buy failed");
    }

    setProcessing(false);
    closeBuyNFTModal();
  };

  // ---------------- UI ----------------
  if (itemsLoading) return <ShopLoadingState />;
  if (itemsError) return <ShopErrorState error={itemsError} />;

  return (
    <div className="shop-container">
      <div className="shop-inner">
        <h1 className="shop-title">Item Shop</h1>

        <QuickActions
          onBuyClick={() => openModal("buy")}
          onSellClick={() => openModal("sell")}
          isLoading={isOpeningModal}
        />

        <div className="item-list">
          {items.length === 0 ? (
            <EmptyShopState />
          ) : (
            items.map((item) => (
              <ItemCard
                key={item.typeId}
                item={item}
                onBuy={openBuyNFTModal}
                balance={balance}
                ethBalance={ethBalance}
                decimals={tokenDecimals}
                isConnected={connected}
                isLoading={isProcessing}
              />
            ))
          )}
        </div>

        <ExchangeModal
          isOpen={modalOpen}
          type={modalType}
          onClose={closeModal}
          onConfirm={handleConfirmExchange}
          price={price}
          balance={availableZkn}
          ethBalance={ethBalance}
          decimals={tokenDecimals}
          isLoading={isProcessing}
        />

        <BuyNFTModal
          isOpen={buyModalOpen}
          item={selectedItem}
          ethBalance={ethBalance}
          onClose={closeBuyNFTModal}
          onConfirm={({ lockDuration, totalEth }) =>
            handleBuyItem(selectedItem, lockDuration, totalEth)
          }
          isLoading={isProcessing}
        />
      </div>
    </div>
  );
}