// ConnectWalletButton.jsx
export function ConnectWalletButton({ address, connectWallet, disconnectWallet }) {
  const handleClick = () => {
    if (address) disconnectWallet();
    else connectWallet();
  };

  return (
    <button
      className={`btn wallet-button ${address ? "connected" : "disconnected"}`}
      onClick={handleClick}
    >
      {address ? "Disconnect" : "Connect"}
    </button>
  );
}
