import { formatETHBalance, formatZKNBalance } from "@utils/formatters";
import "@styles/Modal.css";

export const EthActionModal = ({
  showEthModal,
  setShowEthModal,
  ethAction,
  setEthAction,
  tokenInfo,
  loadingToken,
  exceedsMaxInvestment,
  selectedETH,
  getTotalSelectedETHAmount,
  reinvestDuration,
  setReinvestDuration,
  expectedProfit,
  loadingProfit,
  modalError,
  setModalError,
  isProcessing,
  decimals,
  handleProcess,
}) => {
  if (!showEthModal) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="modal-title">Select ETH Action</h2>

        <div className="modal-body">
          {/* Action Selection */}
          <div className="modal-section">
            <label className="modal-checkbox-label">
              <input
                type="radio"
                name="ethAction"
                value="withdraw"
                checked={ethAction === "withdraw"}
                onChange={() => {
                  setEthAction("withdraw");
                  setModalError("");
                }}
              />
              Withdraw to Wallet
            </label>

            <label className="modal-checkbox-label">
              <input
                type="radio"
                name="ethAction"
                value="deposit"
                checked={ethAction === "deposit"}
                onChange={() => {
                  setEthAction("deposit");
                  setModalError("");
                }}
              />
              Withdraw to Contract
            </label>

            <label className="modal-checkbox-label">
              <input
                type="radio"
                name="ethAction"
                value="reinvest"
                checked={ethAction === "reinvest"}
                onChange={() => setEthAction("reinvest")}
                disabled={tokenInfo && exceedsMaxInvestment()}
              />
              Reinvest (Lock Again)
              {tokenInfo && exceedsMaxInvestment() && (
                <span className="max-limit-warning">
                  — Exceeds max investment of {tokenInfo.itemType.maxInvestment} ETH
                </span>
              )}
            </label>
          </div>

          {/* Max investment warning */}
          {ethAction === "reinvest" && tokenInfo && exceedsMaxInvestment() && (
            <div className="investment-warning">
              <p className="warning-text">
                ⚠️ Total selected amount ({formatETHBalance(getTotalSelectedETHAmount(), 7)} ETH)
                exceeds maximum investment limit ({tokenInfo.itemType.maxInvestment} ETH)
              </p>
              <p className="warning-hint">
                Deselect some locks or choose a different action
              </p>
            </div>
          )}

          {/* Duration Input with Min/Max buttons */}
          {ethAction === "reinvest" && !exceedsMaxInvestment() && (
            <>
              {loadingToken ? (
                <div className="loading-item-type">
                  <p>Loading NFT details...</p>
                </div>
              ) : tokenInfo && tokenInfo.itemType ? (
                <>
                  <label className="modal-label">Lock Duration (seconds):</label>
                  <div className="input-column">
                    <input
                      type="number"
                      className="modal-input"
                      value={reinvestDuration}
                      min={tokenInfo.itemType.minLockDuration}
                      max={tokenInfo.itemType.maxLockDuration}
                      onChange={(e) =>
                        setReinvestDuration(Number(e.target.value))
                      }
                    />
                    <div className="button-column">
                      <button
                        className="max-btn small"
                        onClick={() => setReinvestDuration(tokenInfo.itemType.minLockDuration)}
                      >
                        Min
                      </button>
                      <button
                        className="max-btn small"
                        onClick={() => setReinvestDuration(tokenInfo.itemType.maxLockDuration)}
                      >
                        Max
                      </button>
                    </div>
                  </div>
                  <p className="duration-hint">
                    Min: {Math.round(tokenInfo.itemType.minLockDuration / (24 * 60 * 60))} days —
                    Max: {Math.round(tokenInfo.itemType.maxLockDuration / (24 * 60 * 60))} days
                  </p>
                  <p className="strategy-info">
                    Strategy: {tokenInfo.itemType.name} ({tokenInfo.itemType.apr / 100}% APR)
                  </p>
                  <p className="strategy-info">
                    NFT Token ID: {tokenInfo.tokenId}
                  </p>
                  <p className="investment-limits">
                    Investment Limits: {tokenInfo.itemType.minInvestment} ETH (min) — {tokenInfo.itemType.maxInvestment} ETH (max)
                  </p>
                </>
              ) : (
                <p className="error-text">Could not load NFT details</p>
              )}
            </>
          )}

          {/* Selection Info & Profit */}
          <div className="investment-summary">
            <div className="investment-column">
              <p className="summary-label">Selected Locks:</p>
              <p className="summary-value">{selectedETH.size} ETH locks</p>
            </div>

            <div className="investment-column">
              <p className="summary-label">Total Amount:</p>
              <p className="summary-value">
                {formatETHBalance(getTotalSelectedETHAmount(), 7)} ETH
              </p>
            </div>
          </div>

          {/* Profit Calculation */}
          {ethAction === "reinvest" && tokenInfo && tokenInfo.itemType && !exceedsMaxInvestment() && (
            <div className="profit-section">
              <p className="total">
                Expected Profit:{" "}
                {loadingProfit ? (
                  "Calculating..."
                ) : expectedProfit !== null && expectedProfit !== undefined ? (
                  `${formatZKNBalance(expectedProfit, decimals, 4)} ZKN`
                ) : (
                  "—"
                )}
              </p>
              <p className="total-details">
                Based on {formatETHBalance(getTotalSelectedETHAmount(), 7)} ETH for {Math.round(reinvestDuration / (24 * 60 * 60))} days
              </p>
            </div>
          )}

          {modalError && (
            <div className="modal-error">{modalError}</div>
          )}
        </div>

        <div className="modal-actions">
          <button
            className="modal-cancel"
            onClick={() => {
              setShowEthModal(false);
              setEthAction(null);
              setModalError("");
            }}
          >
            Cancel
          </button>

          <button
            className="modal-confirm"
            disabled={
              !ethAction ||
              (ethAction === "reinvest" && (!reinvestDuration || !tokenInfo || !tokenInfo.itemType || exceedsMaxInvestment())) ||
              isProcessing
            }
            onClick={async () => {
              if (ethAction === "reinvest") {
                if (!tokenInfo || !tokenInfo.itemType) {
                  setModalError("NFT details not loaded");
                  return;
                }

                if (exceedsMaxInvestment()) {
                  setModalError(`Total amount exceeds maximum investment limit of ${tokenInfo.itemType.maxInvestment} ETH`);
                  return;
                }

                if (
                  reinvestDuration < tokenInfo.itemType.minLockDuration ||
                  reinvestDuration > tokenInfo.itemType.maxLockDuration
                ) {
                  setModalError(`Duration must be between ${tokenInfo.itemType.minLockDuration} and ${tokenInfo.itemType.maxLockDuration} seconds`);
                  return;
                }
              }

              if (ethAction === "reinvest") {
                console.log("Confirm clicked");
                await handleProcess("ZKN", "reinvest");
              } else {
                await handleProcess("ETH", ethAction);
              }
              setShowEthModal(false);
            }}
          >
            {isProcessing ? "Processing..." : `Confirm ${ethAction ? `(${ethAction})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};
