import "@styles/pick-a-chance.css";
import { useConstants } from "@hooks/useConstants";
import { usePickAChanceLogic } from "@hooks/usePickAChanceLogic";
import { useContractBalance } from "@context/BalanceContext";
import { useWallet } from "@context/WalletContext";
import { formatZKNBalance } from "@utils/formatters";

export function PickAChance() {
  const { decimals } = useContractBalance();
  const { connectWallet, connected } = useWallet();
  const { balance } = useContractBalance();
  const { MIN_BET, BET_STEP, MIN_CHANCE, CHANCE_STEP, MAX_CHANCE } = useConstants();
  const {
    chance, bet, history, animate, loading, possibleWin,
    play, changeChance, changeBet, chanceInput
  } = usePickAChanceLogic();

  const handlePlay = async () => {
    await play();
  };

  // Convert wei values to ZKN for the sliders (4 decimals)
  const minBetZKN = Number(MIN_BET) / 10**decimals;
  const betStepZKN = Number(BET_STEP) / 10**decimals;
  const balanceZKN = Number(balance) / 10**decimals;
  const betNumber = bet;

  // Convert chance constants to display format
  const minChanceDisplay = (MIN_CHANCE / 100).toFixed(2);
  const maxChanceDisplay = (MAX_CHANCE / 100).toFixed(2);
  const chanceStepDisplay = (CHANCE_STEP / 100).toFixed(2);

  // Calculate percentage for CSS gradient
  const chancePercent = ((parseFloat(chance) - parseFloat(minChanceDisplay)) /
    (parseFloat(maxChanceDisplay) - parseFloat(minChanceDisplay))) * 100;

  // Calculate bet percentage for CSS gradient
  const betPercent = balanceZKN > 0 ? (betNumber / balanceZKN) * 100 : 0;
  const winAmount = parseFloat(possibleWin);
  const rawMultiplier = betNumber > 0 && winAmount > 0 ? (winAmount / betNumber) : 0;

  // Format multiplier with smart precision and ~ sign for long decimals
  const formatMultiplier = (multiplier) => {
    if (multiplier === 0) return "0.00x";

    // Check if multiplier has many decimal places
    const decimalPlaces = (multiplier.toString().split('.')[1] || '').length;

    // For multipliers close to 1 with small variations (like 1.0001x)
    if (Math.abs(multiplier - 1) < 0.01 && multiplier !== 1) {
      if (decimalPlaces > 4) {
        return `~${multiplier.toFixed(4)}x`;
      }
      return `${multiplier.toFixed(4)}x`;
    }

    // For multipliers with more than 5 decimal places, show up to 4 with ~
    if (decimalPlaces > 5) {
      return `~${multiplier.toFixed(4)}x`;
    }

    // For normal multipliers (1.2x, 2.5x, etc.), remove unnecessary zeros
    const formatted = multiplier.toFixed(4); // Start with 4 decimal places
    const withoutTrailingZeros = formatted.replace(/\.?0+$/, ''); // Remove trailing zeros
    const final = withoutTrailingZeros.endsWith('.') ? withoutTrailingZeros + '0' : withoutTrailingZeros;

    return `${final}x`;
  };

  const multiplier = formatMultiplier(rawMultiplier);

  return (
    <div className="page-container">
      <div className="paper">
        <h1 className="title">Pick-a-Chance</h1>

        {/* Show current balance */}
        <div className="balance-display">
          ZKN Balance: <strong>{formatZKNBalance(balance, decimals, 4)}</strong>
        </div>

        <div className="game-wrapper">
          {/* Left side: Game controls and possible win */}
          <div className="game-controls-section">
            <div className="game-controls">
              {/* Chance slider */}
              <div className="slider-group">
                <div className="slider-label">Winning Chance</div>
                <div className="slider-controls">
                  <input
                    type="range"
                    min={minChanceDisplay}
                    max={maxChanceDisplay}
                    step={chanceStepDisplay}
                    value={chanceInput}
                    onChange={(e) => changeChance(e.target.value)}
                    className="slider"
                    style={{ '--percent': `${chancePercent}%` }}
                  />

                  <input
                    type="number"
                    min={minChanceDisplay}
                    max={maxChanceDisplay}
                    step={chanceStepDisplay}
                    value={chanceInput}
                    onChange={(e) => changeChance(e.target.value)}
                    className="bet-input"
                  />

                  <div className="slider-value">{parseFloat(chance).toFixed(2)}%</div>
                </div>
              </div>

              {/* Bet slider */}
              <div className="slider-group">
                <div className="slider-label">Bet Amount</div>
                <div className="slider-controls">
                  <input
                    type="range"
                    min={minBetZKN}
                    max={Math.max(balanceZKN, minBetZKN)}
                    step={betStepZKN}
                    value={betNumber}
                    onChange={(e) => changeBet(e.target.value)}
                    className="slider"
                    style={{ '--percent': `${betPercent}%` }}
                  />

                  <input
                    type="number"
                    min={minBetZKN}
                    max={balanceZKN}
                    step={betStepZKN}
                    value={betNumber}
                    onChange={(e) => changeBet(e.target.value)}
                    className="bet-input"
                  />

                  <div className="slider-value">{betNumber.toFixed(4)} ZKN</div>
                </div>
              </div>

              {/* Buttons */}
              <div className="play-button-container">
                {!connected ? (
                  <button className="btn play-button" onClick={connectWallet}>
                    Connect Wallet
                  </button>
                ) : (
                  <button
                    className="btn play-button"
                    onClick={handlePlay}
                    disabled={loading || betNumber < minBetZKN || betNumber > balanceZKN}
                  >
                    {loading ? "Playing..." : "Play"}
                  </button>
                )}
              </div>
            </div>

            {/* Possible Win Box - positioned to the right with proper spacing */}
            <div className="possible-win-section">
              <div className="possible-win-card">
                <div className="win-flow">
                  <div className="flow-item">
                    <div className="flow-amount">{betNumber.toFixed(4)} ZKN</div>
                    <div className="flow-label">BET</div>
                  </div>

                  <div className="flow-arrow">→</div>

                  <div className="flow-item">
                    <div className="flow-amount">{possibleWin} ZKN</div>
                    <div className="flow-label">WIN</div>
                  </div>
                </div>

                <div className="win-details">
                  <div className="detail-row">
                    <span>Chance:</span>
                    <strong>{chance}%</strong>
                  </div>
                  <div className="detail-row">
                    <span>Multiplier:</span>
                    <strong>{multiplier}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Profit:</span>
                    <strong>+{(winAmount - betNumber).toFixed(4)} ZKN</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side: Results */}
          <div className="result-wrapper">
            {history.map((r, index) => (
              <div
                key={index}
                className={`result ${index === 0 && animate ? "animate" : ""} ${r.win ? "win" : "lose"}`}
                style={{ opacity: 1 - index * 0.15 }}
              >
                {r.text}
              </div>
            ))}
          </div>
        </div>

        {/* Explanation */}
        <div className="game-explanation">
          <h2>How to Play:</h2>
          <p>
            Pick a chance between {minChanceDisplay}% and {maxChanceDisplay}% that you will win.
            Set your bet amount. Press "Play" to see if you win!
            Wins increase your balance, losses decrease it.
          </p>
          <p style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '0.5rem' }}>
            <strong>Note:</strong> Your balance updates automatically after each game.
            The displayed "Possible Win" shows what you could win if successful.
          </p>
        </div>

      </div>
    </div>
  );
}