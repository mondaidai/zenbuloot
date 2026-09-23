import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useInvestments } from "@hooks/useInvestments";
import { useContractSettings } from "@hooks/useContractSettings";
import { formatZKNBalance } from "@utils/formatters";
import "@styles/Modal.css";

export function InvestModal({
    item,
    ethBalance,
    isOpen,
    onClose,
    alreadyInvested,
    availableETHInContract,
    onConfirm
}) {
    if (!isOpen || !item) return null;

    const { decimals } = useContractSettings();
    const { getExpectedProfit, feeSettings } = useInvestments();

    // Convert ETH balances to numbers
    const ethBalanceETH = Number(ethers.formatEther(ethBalance || 0n));
    const alreadyInvestedETH = Number(ethers.formatEther(alreadyInvested || 0n));
    const depositETH = Number(ethers.formatEther(availableETHInContract || 0n));

    // Local state
    const [investmentAmountETH, setInvestmentAmountETH] = useState(0);
    const [lockDuration, setLockDuration] = useState(item.itemType.minLockDuration);
    const [useDeposit, setUseDeposit] = useState(true);

    // Profit calculation
    const [expectedProfit, setExpectedProfit] = useState(0);
    const [loadingProfit, setLoadingProfit] = useState(false);

    const totalETH = Number(investmentAmountETH);

    // ====== Min / Max Handlers ======

    const handleSetMinInvestment = () =>
        setInvestmentAmountETH(item.itemType.minInvestment);

    const handleSetMaxInvestment = () => {
        const walletETH = Number(ethers.formatEther(ethBalance || 0n));
        const depositETH = Number(ethers.formatEther(availableETHInContract || 0n));

        const totalAvailable = useDeposit ? walletETH + depositETH : walletETH;

        setInvestmentAmountETH(
            Math.min(totalAvailable, item.itemType.maxInvestment)
        );
    };


    const handleSetMinDuration = () =>
        setLockDuration(item.itemType.minLockDuration);

    const handleSetMaxDuration = () =>
        setLockDuration(item.itemType.maxLockDuration);

    useEffect(() => {
        async function fetchProfit() {
            if (!investmentAmountETH || investmentAmountETH <= 0) {
                setExpectedProfit(0);
                return;
            }

            try {
                setLoadingProfit(true);

                const profit = await getExpectedProfit(
                    ethers.parseEther(investmentAmountETH.toString()),
                    lockDuration,
                    item.itemType.apr,
                    Number(item.itemType.strategyId)
                );

                if (!feeSettings) {
                    setExpectedProfit(null);
                    return;
                }

                const feeRate = BigInt(feeSettings.performanceFee);
                const base = 10000n;

                const performanceFee = profit * feeRate / base;

                setExpectedProfit(
                    formatZKNBalance(profit - performanceFee, decimals, 4)
                );
            } catch (e) {
                console.error(e);
                setExpectedProfit(null);
            } finally {
                setLoadingProfit(false);
            }
        }

        fetchProfit();
    }, [investmentAmountETH, lockDuration, item, item.itemType.apr, item.itemType.strategyId]);

    return (
        <div className="modal-overlay">
            <div className="modal">
                <h2 className="modal-title">Invest ETH</h2>

                <div className="modal-body">
                    {/* Investment input */}
                    <label className="modal-label">Investment (ETH):</label>
                    <div className="input-column">
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="modal-input"
                            value={investmentAmountETH}
                            onChange={(e) => {
                                const val = e.target.value;

                                // prevent NaN
                                if (val === "" || isNaN(Number(val))) {
                                    setInvestmentAmountETH(0);
                                    return;
                                }

                                setInvestmentAmountETH(Number(val));
                            }}
                        />
                        <div className="button-column">
                            <button className="max-btn small" onClick={handleSetMinInvestment}>Min</button>
                            <button className="max-btn small" onClick={handleSetMaxInvestment}>Max</button>
                        </div>
                    </div>

                    {/* Lock duration */}
                    <label className="modal-label">Lock Duration (seconds):</label>
                    <div className="input-column">
                        <input
                            type="number"
                            min={item.itemType.minLockDuration}
                            max={item.itemType.maxLockDuration}
                            className="modal-input"
                            value={lockDuration}
                            onChange={(e) => setLockDuration(Number(e.target.value))}
                        />
                        <div className="button-column">
                            <button className="max-btn small" onClick={handleSetMinDuration}>Min</button>
                            <button className="max-btn small" onClick={handleSetMaxDuration}>Max</button>
                        </div>
                    </div>

                    {/* Deposit checkbox */}
                    <div className="modal-checkbox">
                        <label>
                            <input
                                type="checkbox"
                                checked={useDeposit}
                                onChange={(e) => setUseDeposit(e.target.checked)}
                            />
                            Use existing deposit
                        </label>
                    </div>

                    {/* Summary section */}
                    <div className="investment-summary">
                        <div className="investment-column">
                            <p className="total">Already Invested:</p>
                            <p className="amount">{alreadyInvestedETH} ETH</p>
                        </div>

                        <div className="investment-column">
                            <p className="total">Deposited:</p>
                            <p className="amount">{depositETH} ETH</p>
                        </div>
                    </div>

                    {/* Profit */}
                    <p className="total">
                        Profit:{" "}
                        {loadingProfit
                            ? "Loading..."
                            : expectedProfit !== null
                                ? `${expectedProfit} ZKN`
                                : "—"}
                    </p>

                    <p className="total">Total: {totalETH} ETH</p>
                </div>

                <div className="modal-actions">
                    <button className="modal-cancel" onClick={onClose}>Cancel</button>

                    <button
                        className="modal-confirm"
                        onClick={() =>
                            onConfirm({
                                investmentAmountETHWei: ethers.parseEther(totalETH.toString()),
                                lockDuration,
                                useDeposit
                            })
                        }
                    >
                        Confirm Investment
                    </button>
                </div>
            </div>
        </div>
    );
}
