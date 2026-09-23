import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { toast } from "react-toastify";
import { formatETHBalance, formatZKNBalance } from "@utils/formatters";
import "@styles/Modal.css";

export function ExchangeModal({ 
  isOpen, 
  type, 
  onClose, 
  onConfirm, 
  price, 
  balance, 
  ethBalance, 
  decimals,
  isLoading 
}) {
  const [modalValue, setModalValue] = useState({ zkn: '', eth: '' });

  useEffect(() => {
    if (isOpen) setModalValue({ zkn: '', eth: '' });
  }, [isOpen]);

  const handleInputChange = (field, value) => {
    const clean = value.replace(/[^0-9.]/g, '');
    if (!clean) return setModalValue({ zkn: '', eth: '' });

    const priceWei = price || BigInt(50000000000000);
    const priceEth = Number(ethers.formatEther(priceWei.toString()));

    if (field === "zkn") {
      setModalValue({
        zkn: clean,
        eth: (Number(clean) * priceEth).toFixed(6)
      });
    } else {
      setModalValue({
        zkn: (Number(clean) / priceEth).toFixed(2),
        eth: clean
      });
    }
  };

  const handleMaxClick = () => {
    const maxZkn = Number(ethers.formatUnits(balance, decimals)).toFixed(4);
    const priceWei = price || BigInt(50000000000000);
    const priceEth = Number(ethers.formatEther(priceWei.toString()));

    setModalValue({
      zkn: maxZkn,
      eth: (Number(maxZkn) * priceEth).toFixed(6)
    });
  };

  const getETHReceived = () => {
    if (!modalValue.zkn) return "0";
    const priceWei = price || BigInt(50000000000000);
    const priceEth = Number(ethers.formatEther(priceWei.toString()));
    return (Number(modalValue.zkn) * priceEth).toFixed(6);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">

        <h3 className="modal-title">
          {type === "buy" ? "Buy ZKN" : "Sell ZKN"}
        </h3>

        <div className="modal-body">
          {type === "buy" ? (
            <>
              <input
                className="modal-input"
                type="number"
                placeholder="ZKN amount"
                value={modalValue.zkn}
                onChange={(e) => handleInputChange("zkn", e.target.value)}
                autoFocus
              />

              <input
                className="modal-input"
                type="number"
                placeholder="ETH amount"
                value={modalValue.eth}
                onChange={(e) => handleInputChange("eth", e.target.value)}
              />

              <div className="price-info">
                Price: 1 ZKN = {ethers.formatEther(price || 50000000000000n)} ETH
              </div>

              <div className="balance-check">
                You have {formatETHBalance(ethBalance, 7)} ETH
              </div>
            </>
          ) : (
            <>
              <div className="input-row">
                <input
                  className="modal-input"
                  type="number"
                  placeholder="ZKN amount to sell"
                  value={modalValue.zkn}
                  onChange={(e) => setModalValue({ ...modalValue, zkn: e.target.value })}
                  autoFocus
                />
                <button
                  className="max-btn"
                  onClick={handleMaxClick}
                  disabled={isLoading}
                >
                  MAX
                </button>
              </div>

              <div className="price-info">
                You will receive: {getETHReceived()} ETH
              </div>

              <div className="balance-check">
                You have {formatZKNBalance(balance, decimals, 4)} ZKN
              </div>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button className="modal-confirm" onClick={() => onConfirm(modalValue, type)} disabled={isLoading}>
            {isLoading ? "Processing..." : "Confirm"}
          </button>
        </div>

      </div>
    </div>
  );
}
