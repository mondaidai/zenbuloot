// Navbar.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConnectWalletButton } from "@components/ConnectWalletButton";
import { useWallet } from "@/context/WalletContext";
import { useContractBalance } from "@/context/BalanceContext";
import { formatEthAddress, formatZKNBalance, formatETHBalance } from "@utils/formatters";
import "@styles/navbar.css";
import "@styles/style.css";
import logo from "@assets/logo.svg";

export function Navbar() {
  const { address, network, connectWallet, disconnectWallet } = useWallet();
  const {
    ethBalance,
    decimals,
    lockedZknBalance,
    lockedEthBalance,
    availableEthInVault,
    availableZkn,
    refreshBalances,
    fetchETHBalance,
  } = useContractBalance();

  const [refreshingZKN, setRefreshingZKN] = useState(false);
  const [refreshingETH, setRefreshingETH] = useState(false);

  const handleRefreshZKN = async () => {
    if (!address || refreshingZKN) return;
    try {
      setRefreshingZKN(true);
      await refreshBalances();
    } catch (err) {
      console.error("Failed to refresh ZKN balances:", err);
    } finally {
      setRefreshingZKN(false);
    }
  };

  const handleRefreshETH = async () => {
    if (!address || refreshingETH) return;
    try {
      setRefreshingETH(true);
      await fetchETHBalance();
    } catch (err) {
      console.error("Failed to refresh ETH balance:", err);
    } finally {
      setRefreshingETH(false);
    }
  };

  const formattedETH = formatETHBalance(ethBalance, 7);
  const formattedLockedZKN = formatZKNBalance(lockedZknBalance, decimals, 4);
  const formattedLockedETH = formatETHBalance(lockedEthBalance, 7);
  const formattedAvailableZKN = formatZKNBalance(availableZkn, decimals, 4);

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <img src={logo} alt="ZenbuLoot Logo" className="navbar-logo" />
        <h1 className="navbar-title">ZenbuLoot</h1>
      </div>

      <div className="navbar-right">
        <div className="wallet-container">

          {/* ETH Balance */}
          <div
            className="wallet-balance"
            role="button"
            title="Click to refresh ETH balance"
            onClick={handleRefreshETH}
            style={{
              cursor: address ? "pointer" : "default",
              opacity: address ? 1 : 0.7,
              textAlign: "center"
            }}
          >
            <div className="balance-label">Your ETH</div>
            <div>{refreshingETH ? "⟳" : formattedETH} ETH</div>
          </div>

          {/* Available / Locked Balances */}
          <div
            className="wallet-balance"
            role="button"
            title="Click to refresh ZKN and vault ETH balances"
            onClick={handleRefreshZKN}
            style={{
              cursor: address ? "pointer" : "default",
              opacity: address ? 1 : 0.7,
              textAlign: "center"
            }}
          >
            <div className="balance-label">Available / Locked</div>

            <div>
              {refreshingZKN ? "⟳" : `${formattedAvailableZKN} / ${formattedLockedZKN}`} ZKN
            </div>

            <div>
              {refreshingZKN ? "⟳" : `${formatETHBalance(availableEthInVault, 7)} / ${formattedLockedETH}`} ETH
            </div>
          </div>

          {/* Wallet Info */}
          <div className="wallet-info">
            <ConnectWalletButton
              address={address}
              connectWallet={connectWallet}
              disconnectWallet={disconnectWallet}
            />
            <div className="wallet-address">
              {address ? formatEthAddress(address) : "Not connected"}
            </div>
            <div className="network-name">{network?.name ?? "\u00A0"}</div>
          </div>

        </div>
      </div>
    </nav>
  );
}
