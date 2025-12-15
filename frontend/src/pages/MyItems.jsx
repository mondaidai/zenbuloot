import { ethers } from "ethers";
import { toast } from "react-toastify";
import { useState, useEffect } from "react";
import { Range } from "react-range";
import { useMyItems } from "@/hooks/useMyItems";
import { InvestModal } from "@components/InvestModal";
import { useInvestments } from "@/hooks/useInvestments";
import { useContractBalance } from "@/context/BalanceContext";
import "@styles/my-items.css";

export function MyItems() {
  const {
    tokens,
    loading,
    error,
    loadOwnedTokens,
    fromBlock,
    setFromBlock,
    latestBlock,
    oldestBlock,
    refreshLatestBlock, // use this when clicking refresh Items and only then use loadOwnedTokens
  } = useMyItems();

  const [sliderValues, setSliderValues] = useState([0, 1]);
  const [range, setRange] = useState([0, 0]);
  const [isInitialized, setIsInitialized] = useState(false);
  const { getInvestmentsForToken, handleInvest } = useInvestments();
  const { availableEthInVault, ethBalance } = useContractBalance();

  // Helper: clamp value into [min, max]
  const clamp = (v, a, b) => Math.max(a, Math.min(v, b));

  // Determine safe min block for slider (prefer oldestBlock, fallback to fromBlock)
  const minBlockForSlider = (() => {
    if (oldestBlock && oldestBlock > 0) return oldestBlock;
    if (fromBlock && fromBlock > 0) return fromBlock;
    return 0;
  })();

  const SLIDER_POWER = 6;

  // sliderValue in [0..1] -> block number (biased towards recent)
  const sliderToBlock = (sliderValue) => {
    if (!latestBlock || latestBlock === 0) return minBlockForSlider || 0;

    const minB = minBlockForSlider && minBlockForSlider > 0 ? minBlockForSlider : 0;
    const r = Math.max(1, latestBlock - minB); // avoid zero
    const offsetFraction = Math.pow(1 - sliderValue, SLIDER_POWER);
    return Math.round(latestBlock - offsetFraction * r);
  };

  // block number -> slider value in [0..1]
  const blockToSlider = (block) => {
    if (!latestBlock || latestBlock === 0) return 0;

    const minB = minBlockForSlider && minBlockForSlider > 0 ? minBlockForSlider : 0;
    const r = Math.max(1, latestBlock - minB);
    // clamp block into allowed range
    const clampedBlock = clamp(block || minB, minB, latestBlock);
    const frac = (latestBlock - clampedBlock) / r;
    return 1 - Math.pow(Math.max(0, frac), 1 / SLIDER_POWER);
  };

  const formatExpiry = (val) => {
    if (!val) return "—";
    const n = Number(val);
    if (Number.isNaN(n)) return "—";
    const date = n > 1e12 ? new Date(n) : new Date(n * 1000);
    return date.toLocaleString();
  };

  // displayedRange shows range even while not initialized (keeps UI stable)
  const displayedRange = isInitialized
    ? [range[0], range[1]]
    : [minBlockForSlider || 0, latestBlock || 0];

  // ----------------------------
  // Ensure fromBlock is safe (clamp or auto-set once)
  // ----------------------------
  useEffect(() => {
    if (!latestBlock || latestBlock === 0) return;

    setFromBlock((prev) => {
      // If user already set fromBlock manually (non-zero), keep it but clamp it.
      if (prev && prev > 0) {
        const minAllowed = oldestBlock && oldestBlock > 0 ? oldestBlock : 0;
        return clamp(prev, minAllowed, latestBlock);
      }

      // Auto compute default: latest - 20k window, but never below oldestBlock
      const defaultWindow = Math.max(0, latestBlock - 20000);
      const minAllowed = oldestBlock && oldestBlock > 0 ? oldestBlock : 0;
      return clamp(defaultWindow, minAllowed, latestBlock);
    });
    // Note: we depend on latestBlock and oldestBlock (setFromBlock uses both).
  }, [latestBlock, oldestBlock, setFromBlock]);

  // ----------------------------
  // Initialize slider values once we have safe numbers
  // ----------------------------
  useEffect(() => {
    // Need latestBlock and a safe minBlockForSlider and fromBlock set
    if (!latestBlock || latestBlock === 0) return;
    if (!minBlockForSlider || minBlockForSlider === 0) return;
    if (!fromBlock || fromBlock === 0) return;
    if (isInitialized) return;

    // compute slider positions
    const s = blockToSlider(fromBlock);
    const e = blockToSlider(latestBlock);

    setSliderValues([Math.min(s, e), Math.max(s, e)]);
    setRange([Math.min(fromBlock, latestBlock), Math.max(fromBlock, latestBlock)]);
    setIsInitialized(true);
  }, [latestBlock, minBlockForSlider, fromBlock, isInitialized]);

  // ----------------------------
  // Update numeric range when slider thumbs move
  // ----------------------------
  useEffect(() => {
    if (!isInitialized) return;

    const a = sliderToBlock(sliderValues[0]);
    const b = sliderToBlock(sliderValues[1]);

    // Clamp produced blocks into allowed interval
    const low = clamp(Math.min(a, b), minBlockForSlider || 0, latestBlock || a);
    const high = clamp(Math.max(a, b), low, latestBlock || b);

    setRange([low, high]);
  }, [sliderValues, isInitialized, minBlockForSlider, latestBlock]);

  // ----------------------------
  // Trigger fetch when range changes (debounced)
  // ----------------------------
  useEffect(() => {
    if (!isInitialized) return;
    const [start, end] = range;
    if (!start || !end || end <= 0) return;

    // ensure final safe bounds
    const safeStart = clamp(start, minBlockForSlider || 0, latestBlock || end);
    const safeEnd = clamp(end, safeStart, latestBlock || end);

    const timeoutId = setTimeout(() => {
      loadOwnedTokens(safeStart, safeEnd);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [range, isInitialized, minBlockForSlider, latestBlock, loadOwnedTokens]);

  const handleSliderChange = (values) => {
    const [start, end] = values;
    if (start <= end) setSliderValues(values);
    else setSliderValues([values[1], values[1]]);
  };

  // ------------------------
  // MODAL LOGIC
  // ------------------------
  const [isInvestModalOpen, setIsInvestModalOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  const [alreadyInvested, setAlreadyInvested] = useState(0n);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const openInvestModal = async (token) => {
    setSelectedToken(token);

    try {
      const { ethInvestments = [], zknInvestments = [] } = await getInvestmentsForToken(token.tokenId);

      const totalETHInvested = ethInvestments
        .filter((inv) => !inv.claimed)
        .reduce((sum, inv) => sum + BigInt(inv.amount ?? 0n), 0n);

      setAlreadyInvested(totalETHInvested);
    } catch (err) {
      console.warn("Failed to fetch investments:", err);
      toast.warn("Could not fetch existing investments.");
      setAlreadyInvested(0n);
    }

    setIsInvestModalOpen(true);
  };

  const closeInvestModal = () => {
    setIsInvestModalOpen(false);
    setSelectedToken(null);
  };

  return (
    <div className="shop-container">
      <div className="shop-inner">
        <h1 className="shop-title">My Items</h1>

        <div className="my-items-controls">
          <div className="my-items-range">
            <div className="my-items-range-header">
              <label>
                Block range: {displayedRange[0]} – {displayedRange[1]}
                {displayedRange[1] - displayedRange[0] > 0 && (
                  <span className="my-items-range-count">
                    ({((displayedRange[1] - displayedRange[0]) / 1000).toFixed(1)}k blocks)
                  </span>
                )}
              </label>
            </div>
            <div className="my-items-range-with-refresh">
              <div className="my-items-range-left">
                <div className="my-items-range-top">
                  <div className="my-items-range-slider">
                <Range
                  step={0.001}
                  min={0}
                  max={1}
                  values={sliderValues}
                  onChange={handleSliderChange}
                  renderTrack={({ props, children }) => (
                    <div
                      {...props}
                      className="my-items-range-track"
                      style={{ ...props.style, position: "relative" }}
                    >
                      <div
                        className="my-items-range-selection"
                        style={{
                          position: "absolute",
                          left: `${sliderValues[0] * 100}%`,
                          width: `${(sliderValues[1] - sliderValues[0]) * 100}%`,
                          top: 0,
                          bottom: 0,
                          borderRadius: 3,
                        }}
                      />
                      {children}
                    </div>
                  )}
                  renderThumb={({ props, index }) => {
                    const { transform, ...restStyle } = props.style || {};
                    const { key, ...restProps } = props; // remove key from spread
                    return (
                      <div
                        {...restProps} // spread everything except key
                        key={key} // pass key directly
                        className={`my-items-range-thumb ${index === 0 ? "start" : "end"}`}
                        style={{
                          ...restStyle,
                          transform: `translate(-50%, -50%) ${transform || ""}`,
                        }}
                      />
                    );
                  }}
                />
                  </div>
                </div>

                <div className="my-items-range-labels">
                  <span>Oldest</span>
                  <span>Recent Blocks</span>
                  <span>Latest</span>
                </div>
              </div>

              <div className="my-items-range-actions">
                <button
                  onClick={async () => {
                    setIsRefreshing(true);
                    try {
                      // Fetch the latest block from the provider
                      const newLatest = await refreshLatestBlock();

                      const latestNum = typeof newLatest === 'number' && newLatest > 0 ? newLatest : latestBlock || 0;

                      // Determine a safe start block to keep the left thumb stable (prefer existing fromBlock)
                      const startBlock = fromBlock && fromBlock > 0 ? fromBlock : Math.max(minBlockForSlider || 0, latestNum - 200);

                      // Compute slider positions matching [startBlock, latestNum]
                      const s = blockToSlider(startBlock);
                      const e = blockToSlider(latestNum);

                      const sliderA = Math.min(s, e);
                      const sliderB = Math.max(s, e);

                      const rangeA = Math.min(startBlock, latestNum);
                      const rangeB = Math.max(startBlock, latestNum);

                      // Update local UI state immediately so slider moves to latest
                      setSliderValues([sliderA, sliderB]);
                      setRange([rangeA, rangeB]);

                      // Fetch tokens for the updated range
                      await loadOwnedTokens(rangeA, rangeB);
                    } catch (err) {
                      console.error("Failed to refresh latest block:", err);
                    } finally {
                      setIsRefreshing(false);
                    }
                  }}
                  disabled={loading || isRefreshing}
                  className="my-items-refresh-btn"
                >
                  {isRefreshing ? "Loading..." : "Refresh Items"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading && !isRefreshing && <p className="my-items-message">Loading...</p>}
        {error && <p className="my-items-error">Error: {error}</p>}
        {!loading && tokens.length === 0 && (
          <p className="my-items-message">No items found in this block range.</p>
        )}

        <div className="item-list">
          {tokens.map((t) => (
            <div key={t.tokenId} className="my-items-card clickable" onClick={() => openInvestModal(t)}>
              <div className="my-items-card-header">
                <span>Token #{t.tokenId}</span>
              </div>

              <div className="my-items-card-image">
                <img
                  src={t.itemType.imageURI || "/public/images/placeholder.png"}
                  alt={t.itemType.name}
                  onError={(e) => (e.target.src = "/public/images/placeholder.png")}
                />
              </div>

              <div className="my-items-card-body">
                <h3 className="my-items-card-name">{t.itemType.name}</h3>

                <div className="my-items-card-badges">
                  <span className="badge type-badge">Type {t.playerItem?.typeId ?? "—"}</span>
                  <span className="badge uses-badge">
                    Uses: {t.playerItem?.usesLeft === 0 && !t.playerItem?.consumed ? "∞" : t.playerItem?.usesLeft ?? "—"}
                  </span>
                </div>

                <div className="my-items-card-info">
                  <span>Consumed:</span>
                  <span>{t.playerItem?.consumed ? "Yes" : "No"}</span>
                </div>

                <div className="my-items-card-info">
                  <span>Expires:</span>
                  <span>{t.playerItem?.expiresAt != 0 ? formatExpiry(t.playerItem?.expiresAt) : "Never"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <InvestModal
        isOpen={isInvestModalOpen}
        onClose={closeInvestModal}
        item={selectedToken}
        alreadyInvested={alreadyInvested}
        ethBalance={ethBalance}
        availableETHInContract={availableEthInVault}
        onConfirm={({ investmentAmountETHWei, lockDuration, useDeposit }) => {
          if (!selectedToken) return;
          handleInvest(selectedToken, lockDuration, investmentAmountETHWei, useDeposit);
          closeInvestModal();
        }}
      />
    </div>
  );
}

export default MyItems;