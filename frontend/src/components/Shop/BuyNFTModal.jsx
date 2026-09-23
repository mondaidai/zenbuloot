import { ethers } from "ethers";
import { useState, useEffect } from "react";
import { useInvestments } from "@hooks/useInvestments";
import { formatZKNBalance } from "@utils/formatters";
import { useContractSettings } from "@hooks/useContractSettings";
import "@styles/Modal.css";

export function BuyNFTModal({ item, ethBalance, isOpen, onClose, onConfirm, isLoading }) {
  if (!isOpen || !item) return null;
  const { decimals } = useContractSettings();
  const [localLoading, setLocalLoading] = useState(false);
  const { getExpectedProfit, feeSettings } = useInvestments();
  const ethBalanceETH = ethers.formatEther(ethBalance);

  const basePrice = Number(item.price);
  const [extraEth, setExtraEth] = useState(0);
  const [lockDuration, setLockDuration] = useState(item.minLockDuration);

  const [expectedProfit, setExpectedProfit] = useState(0);
  const [loadingProfit, setLoadingProfit] = useState(false);

  const totalEth = basePrice + Number(extraEth || 0);

  const handleSetMaxExtra = () =>
    setExtraEth(
      item.maxInvestment < ethBalanceETH - basePrice
        ? item.maxInvestment
        : ethBalanceETH - basePrice
    );
  const handleSetMinExtra = () =>
    setExtraEth(
      item.minInvestment < ethBalanceETH - basePrice
        ? item.minInvestment
        : 0
    );
  const handleSetMaxDuration = () => setLockDuration(item.maxLockDuration);
  const handleSetMinDuration = () => setLockDuration(item.minLockDuration);

  // 🚀 Fetch expected profit whenever inputs change
  //   uint256 perfFee = (grossZKN * fees.performanceFee) / 10000;
  useEffect(() => {
    async function fetchProfit() {
      if (!extraEth || Number(extraEth) <= 0) {
        setExpectedProfit(0);
        return;
      }

      try {
        setLoadingProfit(true);

        // profit is BIGINT
        const profit = await getExpectedProfit(
          ethers.parseEther(extraEth.toString()),
          lockDuration,
          item.apr,
          Number(item.strategyId)
        );

        if (!feeSettings) {
          console.warn("Could not load fee settings");
          setExpectedProfit(null);
          return;
        }

        // Convert performance fee to BigInt
        const feeRate = BigInt(feeSettings.performanceFee); // uint16, safe
        const base = 10000n;

        // Calculate fee as BigInt  
        const performanceFee = profit * feeRate / base;

        // Convert to user display value
        setExpectedProfit(
          formatZKNBalance(profit - performanceFee, decimals, 4)
        );

      } catch (e) {
        console.error("Failed to fetch profit:", e);
        setExpectedProfit(null);
      } finally {
        setLoadingProfit(false);
      }
    }

    fetchProfit();
  }, [extraEth, lockDuration, item.apr, item.strategyId]);


  const loading = Boolean(isLoading) || localLoading;

  const handleConfirm = async () => {
    try {
      setLocalLoading(true);
      // onConfirm returns a promise from parent; await it so we can show immediate feedback
      await onConfirm({ totalEth, lockDuration });
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="modal-title">Buy {item.name}</h2>

        <div className="modal-body">
          <p className="price-info"><strong>Base Price:</strong> {basePrice} ETH</p>

          <label className="modal-label">Additional Investment (ETH):</label>
          <div className="input-column">
            <input
              type="number"
              min="0"
              step="0.01"
              className="modal-input"
              value={extraEth}
              onChange={(e) => setExtraEth(e.target.value)}
            />
            <div className="button-column">
              <button className="max-btn small" onClick={handleSetMinExtra}>Min</button>
              <button className="max-btn small" onClick={handleSetMaxExtra}>Max</button>
            </div>
          </div>

          <label className="modal-label">Lock Duration (seconds):</label>
          <div className="input-column">
            <input
              type="number"
              min={item.minLockDuration}
              max={item.maxLockDuration}
              className="modal-input"
              value={lockDuration}
              onChange={(e) => setLockDuration(Number(e.target.value))}
            />
            <div className="button-column">
              <button className="max-btn small" onClick={handleSetMinDuration}>Min</button>
              <button className="max-btn small" onClick={handleSetMaxDuration}>Max</button>
            </div>
          </div>
          <p className="total">
            Profit:{" "}
            {loadingProfit
              ? "Loading..."
              : expectedProfit !== null
                ? `${expectedProfit} ZKN`
                : "—"}
          </p>
          <p className="total">Total: {totalEth} ETH</p>
        </div>

        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="modal-confirm"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : "Confirm Purchase"}
          </button>
        </div>
      </div>
    </div>
  );
}
