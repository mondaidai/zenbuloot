import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useContractBalance } from "@context/BalanceContext";
import { useContractSettings } from "@hooks/useContractSettings";
import ZenbuLoot from "@contracts/ZenbuLoot.json";
import Zenikane from "@contracts/Zenikane.json";
import { ZENBU_LOOT_ADDRESS, ZENIKANE_ADDRESS } from "@/config/contracts";
import { useWallet } from "@context/WalletContext";
import { useConstants } from "./useConstants";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export function usePickAChanceLogic() {
  const { address, connectWallet } = useWallet();
  const { MIN_BET, MIN_CHANCE, MAX_CHANCE, HOUSE_EDGE, PRECISION } = useConstants();
  const { balance } = useContractBalance();
  const { decimals } = useContractSettings(); // <-- dynamic decimals

  const initialChanceDisplay = 50;
  const initialChanceBasisPoints = 5000;
  const [chanceInput, setChanceInput] = useState(initialChanceDisplay.toString());
  const [chance, setChance] = useState(initialChanceBasisPoints);
  const [bet, setBet] = useState(0);
  const [history, setHistory] = useState([]);
  const [animate, setAnimate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [possibleWin, setPossibleWin] = useState("0");

  // Convert based on token decimals
  const weiToZKN = (wei) => Number(wei) / 10 ** decimals;
  const zknToWei = (zkn) => BigInt(Math.round(zkn * 10 ** decimals));
  const getDisplayChance = (bp) => (bp / 100).toFixed(2);
  const getBasisPoints = (displayValue) => Math.round(displayValue * 100);

  const calculatePossibleWin = (betAmount, chanceBasisPoints) => {
    if (!betAmount || betAmount <= 0 || !chanceBasisPoints || chanceBasisPoints <= 0) return "0";
    try {
      const calculateFairReward = (betAmount, chancePercent) => {
        if (chancePercent <= 0 || chancePercent >= PRECISION) return 0;
        return (betAmount * PRECISION) / chancePercent;
      };

      // Compute the input chance value that must be passed to the GameEngine
      // so that after the house edge adjustment the actual win probability
      // equals the user-selected display chance.
      const computeInputChance = (displayBp) => {
        // input = floor(displayBp * PRECISION / (PRECISION - HOUSE_EDGE))
        const raw = Math.floor((Number(displayBp) * PRECISION) / (PRECISION - HOUSE_EDGE));
        if (raw <= 0) return 1;
        if (raw >= PRECISION) return PRECISION - 1;
        return raw;
      };

      const inputChance = computeInputChance(chanceBasisPoints);
      const potentialWin = calculateFairReward(betAmount, inputChance);
      return potentialWin > 0 ? potentialWin.toFixed(4) : "0";
    } catch (err) {
      console.error(err);
      return "0";
    }
  };

  useEffect(() => {
    setPossibleWin(calculatePossibleWin(Number(bet), chance));
  }, [bet, chance]);

  const play = async () => {
    if (!address) {
      await connectWallet();
      return;
    }

    const cleanedBet = Number(bet.toFixed(4));
    const betWei = zknToWei(cleanedBet);
    const minBetZKN = weiToZKN(MIN_BET);
    const balanceZKN = weiToZKN(balance);

    if (cleanedBet < minBetZKN || cleanedBet > balanceZKN) {
      toast.error(`Invalid bet amount. Minimum: ${minBetZKN} ZKN, Maximum: ${balanceZKN} ZKN`);
      return;
    }

    if (chance < MIN_CHANCE || chance > MAX_CHANCE) {
      toast.error(`Invalid chance. Must be between ${getDisplayChance(MIN_CHANCE)}% and ${getDisplayChance(MAX_CHANCE)}%`);
      return;
    }

    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const zenbuLootContract = new ethers.Contract(ZENBU_LOOT_ADDRESS, ZenbuLoot.abi, signer);
      const zknContract = new ethers.Contract(ZENIKANE_ADDRESS, Zenikane.abi, signer);

      const balanceWei = await zknContract.balanceOf(address);
      const balanceFormatted = weiToZKN(balanceWei);

      if (balanceFormatted < cleanedBet) {
        toast.error(`Insufficient ZKN balance. You have ${balanceFormatted} ZKN but need ${cleanedBet} ZKN`);
        setLoading(false);
        return;
      }

      // No ERC-20 approval required: `ZenbuLoot` is the token's privileged
      // ownerContract and calls `zkn.burn(from, amount)` directly, so the
      // contract can burn user balances without a prior `approve`.
      // Therefore we skip any allowance/approve flow and only send the
      // `playGame` transaction below.

      // Compute compensated input chance so actual win prob == selected chance
      const computeInputChance = (displayBp) => {
        const raw = Math.floor((Number(displayBp) * PRECISION) / (PRECISION - HOUSE_EDGE));
        if (raw <= 0) return 1;
        if (raw >= PRECISION) return PRECISION - 1;
        return raw;
      };

      const inputChance = computeInputChance(chance);

      const tx = await zenbuLootContract.playGame(inputChance, betWei, { gasLimit: 500_000 });
      const receipt = await tx.wait();
      const gameResult = await parseGameResult(receipt, zknContract, address, getDisplayChance(chance), cleanedBet);
      return handleGameOutcome(gameResult, cleanedBet);

    } catch (error) {
      console.error(error);
      return handleGameError(error, getDisplayChance(chance), cleanedBet);
    } finally {
      setLoading(false);
    }
  };

  const handleGameOutcome = (gameResult, cleanedBet) => {
    const outcomeValue = (gameResult.win ? gameResult.zknReward : -cleanedBet).toFixed(4);
    const outcome = { text: (gameResult.win ? "+" : "-") + outcomeValue, win: gameResult.win };
    setHistory(prev => [outcome, ...prev].slice(0, 5));
    setAnimate(true);
    setTimeout(() => setAnimate(false), 500);

    if (gameResult.win) toast.success(`You won! Received ${gameResult.zknReward} ZKN`);
    else toast.error(`You lost ${cleanedBet} ZKN`);

    return gameResult.win ? gameResult.zknReward : -cleanedBet;
  };

  const parseGameResult = async (receipt, zknContract, playerAddress, displayChance, betAmount) => {
    try {
      for (const log of receipt.logs) {
        try {
          const parsedLog = zknContract.interface.parseLog(log);
          if (parsedLog?.name === "Transfer") {
            const { from, to, value } = parsedLog.args;
            if (from === "0x0000000000000000000000000000000000000000" && to.toLowerCase() === playerAddress.toLowerCase() && value > 0) {
              const zknReward = weiToZKN(value);
              return { win: true, zknReward, chancePercent: displayChance, betAmount };
            }
          }
        } catch { continue; }
      }
      return { win: false, zknReward: 0, chancePercent: displayChance, betAmount };
    } catch (error) {
      console.error(error);
      return { win: false, zknReward: 0, chancePercent: displayChance, betAmount };
    }
  };

  const handleGameError = (error, displayChance, cleanedBet) => {
    let errorMessage = "Transaction failed. Please try again.";

    if (error.reason?.includes("user rejected") || error.code === 4001) errorMessage = "Transaction was cancelled.";
    else if (error.reason?.includes("insufficient")) errorMessage = "Insufficient balance for this bet.";
    else if (error.reason?.includes("allowance")) errorMessage = "Token approval failed. Please try again.";
    else if (error.reason?.includes("Game engine not set")) errorMessage = "Game engine not configured. Please contact admin.";
    else if (error.reason) errorMessage = `Transaction failed: ${error.reason}`;
    else if (error.message?.includes("revert")) errorMessage = "Transaction reverted. Please check your inputs.";

    toast.error(errorMessage);
    return -cleanedBet;
  };

  const changeChance = (value) => {
    if (value === "") {
      setChanceInput("");
      return;
    }
    if (!/^\d*\.?\d*$/.test(value)) return;
    const parts = value.split(".");
    if (parts[1]?.length > 2) parts[1] = parts[1].slice(0, 2);
    const sanitized = parts.join(".");
    setChanceInput(sanitized);

    const numericValue = parseFloat(sanitized);
    if (!isNaN(numericValue)) {
      const basisPoints = Math.round(numericValue * 100);
      const clamped = Math.min(Math.max(basisPoints, MIN_CHANCE), MAX_CHANCE);
      setChance(clamped);
    }
  };

  const changeBet = (value) => {
    const num = Number(value || 0);
    const minBetZKN = weiToZKN(MIN_BET);
    const balanceZKN = weiToZKN(balance);
    setBet(Math.min(Math.max(num, minBetZKN), balanceZKN));
  };

  return {
    chance: getDisplayChance(chance),
    bet,
    history,
    animate,
    loading,
    possibleWin,
    play,
    changeChance,
    changeBet,
    chanceInput
  };
}
