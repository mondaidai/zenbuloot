import { ethers } from "ethers";
import "./ItemCard.css";

export function ItemCard({
  item,
  onBuy,
  ethBalance,
  isConnected,
  isLoading
}) {
  // Compare ETH price with ETH balance
  const userEth = Number(ethers.formatEther(ethBalance || 0n));
  const itemPrice = Number(item.price);

  const canAfford = isConnected && userEth >= itemPrice;

  const secToDays = (sec) => {
    const days = sec / 86400;
    const fixed = Number(days.toFixed(2));
    return fixed % 1 === 0 ? fixed.toString() : fixed.toFixed(2);
  };

  return (
    <div className="item-card">
      <div className="item-content">
        {item.imageURI && (
          <img src={item.imageURI} alt={item.name} className="item-image" />
        )}

        <div className="item-details">
          <div className="item-name">{item.name}</div>

          <div className="item-desc">
            <p><strong>APR:</strong> {item.apr / 100}%</p>
            <p><strong>Uses:</strong> {item.defaultUses == 0 ? "∞" : item.defaultUses}</p>
            <p><strong>Min:</strong> {item.minInvestment} ETH</p>
            <p><strong>Max:</strong> {item.maxInvestment} ETH</p>

            {item.expiresAt > 0 && (
              <p><strong>Expires:</strong> {new Date(item.expiresAt * 1000).toLocaleString()}</p>
            )}

            {item.retired && (
              <p className="retired-label">RETIRED</p>
            )}
          </div>
        </div>
      </div>

      <div className="item-lock">
        <p><strong>Lock:</strong> {secToDays(item.minLockDuration)}–{secToDays(item.maxLockDuration)} days</p>
      </div>

      <div className="item-price">{item.price} ETH</div>

      <button
        className="buy-button"
        onClick={() => onBuy(item)}
        disabled={!isConnected || !canAfford || isLoading || item.retired}
      >
        {isLoading ? "Buying..." : "Buy"}
      </button>
    </div>
  );
}
