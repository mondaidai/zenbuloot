import { useHistory } from "@hooks/useHistory";
import { EthActionModal } from "@components/EthActionModal";
import { formatZKNBalance, formatETHBalance } from "@utils/formatters";
import "@styles/history.css";

export const History = () => {
  const {
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
  } = useHistory();

  // Build a set of tokenIds that correspond to currently selected ZKN locks.
  const selectedTokenIds = new Set();
  locks.forEach((l) => {
    if (l.zkn && l.zkn.length) {
      l.zkn.forEach((z) => {
        if (z && selectedZKN.has(z.lockId)) selectedTokenIds.add(l.tokenId);
      });
    }
  });

  const hasZeroSelected = selectedTokenIds.has(0);
  const hasNonZeroSelected = Array.from(selectedTokenIds).some((id) => id !== 0);

  // Loading state
  if (isLoading) {
    return (
      <div className="history-container">
        <div className="history-inner">
          <h1 className="history-title">Investment History</h1>
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading locks...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="history-container">
      <div className="history-inner">
        <div className="history-header">
          <h1 className="history-title">Investment History</h1>
          <button
            className="btn-reload"
            onClick={() => fetchLocks()}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Reload"}
          </button>
        </div>

        {hasAnyAvailable && (
          <div className="selection-controls">
            <div className="selection-info">
              {hasAnySelection && (
                <div className="selected-counts">
                  {selectedZKN.size > 0 && (
                    <span className="selected-count zkn-count">
                      {selectedZKN.size} ZKN selected
                    </span>
                  )}
                  {selectedETH.size > 0 && (
                    <span className="selected-count eth-count">
                      {selectedETH.size} ETH selected
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="selection-buttons">
              <button
                className="btn-secondary"
                disabled={getAvailableLocksCount("ZKN") === 0}
                onClick={() => handleSelectAll("ZKN")}
              >
                Select All ZKN
              </button>

              <button
                className="btn-secondary"
                disabled={!hasAnySelection}
                onClick={handleClearSelection}
              >
                Clear All
              </button>

              <button
                className="btn-primary zkn-process"
                disabled={selectedZKN.size === 0 || isProcessing}
                onClick={() => {
                  // If any selected ZKN belong to pending sells (tokenId==0), process the queue instead
                  if (hasZeroSelected) {
                    handleProcess("ZKN", "processQueue");
                  } else {
                    handleProcess("ZKN");
                  }
                }}
              >
                {isProcessing
                  ? "Processing..."
                  : `Process ZKN (${selectedZKN.size})`}
              </button>

              <button
                className="btn-primary eth-process"
                disabled={selectedETH.size === 0 || isProcessing}
                onClick={() => {
                  setEthAction(null);
                  setModalError("");
                  setShowEthModal(true);
                }}
              >
                {isProcessing
                  ? "Processing..."
                  : `Process ETH (${selectedETH.size})`}
              </button>
            </div>
          </div>
        )}

        {locks.length === 0 && (
          <p className="empty-state-history">No locks found</p>
        )}

        <div className="locks-grid">
          {locks.map((lock) => (
            <div key={lock.tokenId} className="lock-card">
                  <div className="lock-header">
                    <strong>
                      {lock.tokenId === 0 ? "Pending ZKN Withdrawal" : `NFT Token ID: ${lock.tokenId}`}
                    </strong>
                  </div>

              <div className="lock-rows">
                {Array.from({ length: getMaxLockCount(lock) }).map(
                  (_, row) => (
                    <div key={row} className="lock-row">
                      {/* ZKN column */}
                      <div className="lock-column zkn-column">
                        {lock.zkn[row] ? (
                          (() => {
                            const lockSelectionDisabledForMixing =
                              (lock.tokenId === 0 && hasNonZeroSelected) ||
                              (lock.tokenId !== 0 && hasZeroSelected);

                            return (
                              <HistoryToken
                                token={lock.zkn[row]}
                                label="ZKN"
                                format={(amt) =>
                                  formatZKNBalance(amt, decimals, 4)
                                }
                                ended={
                                  hasLockEnded(lock.zkn[row].lockEnd) &&
                                  !lock.zkn[row].claimed
                                }
                                selected={selectedZKN.has(lock.zkn[row].lockId)}
                                onSelect={() =>
                                  handleLockSelect(lock.zkn[row].lockId, "ZKN")
                                }
                                disabled={isProcessing || lockSelectionDisabledForMixing}
                              />
                            );
                          })()
                        ) : (
                          <div className="lock-item empty-lock">
                            No ZKN Lock
                          </div>
                        )}
                      </div>

                      {/* ETH column */}
                      <div className="lock-column eth-column">
                        {lock.eth[row] ? (
                          <HistoryToken
                            token={lock.eth[row]}
                            label="ETH"
                            format={(amt) =>
                              formatETHBalance(amt, 7)
                            }
                            ended={
                              hasLockEnded(lock.eth[row].lockEnd) &&
                              !lock.eth[row].claimed
                            }
                            selected={selectedETH.has(
                              lock.eth[row].lockId
                            )}
                            onSelect={() =>
                              handleLockSelect(
                                lock.eth[row].lockId, "ETH"
                              )
                            }
                            disabled={isProcessing}
                          />
                        ) : (
                          <div className="lock-item empty-lock">
                            No ETH Lock
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <EthActionModal
        showEthModal={showEthModal}
        setShowEthModal={setShowEthModal}
        ethAction={ethAction}
        setEthAction={setEthAction}
        tokenInfo={tokenInfo}
        loadingToken={loadingToken}
        exceedsMaxInvestment={exceedsMaxInvestment}
        selectedETH={selectedETH}
        getTotalSelectedETHAmount={getTotalSelectedETHAmount}
        reinvestDuration={reinvestDuration}
        setReinvestDuration={setReinvestDuration}
        expectedProfit={expectedProfit}
        loadingProfit={loadingProfit}
        modalError={modalError}
        setModalError={setModalError}
        isProcessing={isProcessing}
        decimals={decimals}
        handleProcess={handleProcess}
      />
    </div>
  );
};

// Token component
function HistoryToken({
  token,
  label,
  format,
  ended,
  selected,
  onSelect,
  disabled,
}) {
  return (
    <div className={`lock-item token-status--${ended ? "ended" : "active"}`}>
      <div className="lock-checkbox">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          disabled={!ended || disabled}
        />
        {label} — ID: {token.lockId}
      </div>

      <div className="token-details">Amount: {format(token.amount)}</div>
      <div className="token-details">
        Claimed: {token.claimed ? "Yes" : "No"}
      </div>
      <div className="token-details">
        End: {new Date(Number(token.lockEnd) * 1000).toLocaleString()}
      </div>
      <div className="token-details">
        Status: {token.claimed ? "Claimed" : ended ? "Ready" : "Active"}
      </div>
    </div>
  );
}