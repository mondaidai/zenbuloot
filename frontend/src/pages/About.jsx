import "@styles/about.css";

export function About() {
  return (
    <div className="about-container">
      <div className="about-inner">
        <h1 className="about-title">About ZenbuLoot</h1>
        
        <section className="about-hero">
          <p>
            ZenbuLoot is a gamified DeFi protocol where your principal stays safe. 
            By locking SepoliaETH, you generate instant <strong>Zenikane (ZKN)</strong> to play, 
            spend, or hold, while your original ETH earns yield in the background.
          </p>
        </section>

        <hr className="about-divider" />

        <h2>How It Works</h2>
        <div className="flow-grid">
          <div className="flow-step">
            <h3>1. Buy an NFT</h3>
            <p>Purchase an Omamori NFT to unlock an investment slot. Each NFT type defines your APR and lock-up rules.</p>
          </div>
          <div className="flow-step">
            <h3>2. Lock SepoliaETH</h3>
            <p>Choose your lock duration. Your ETH is sent to our <strong>Vault</strong> and invested in DeFi strategies (currently powered by <strong>Aave</strong>).</p>
          </div>
          <div className="flow-step">
            <h3>3. Get Instant ZKN</h3>
            <p>Receive ZKN tokens immediately. The amount is calculated based on your ETH deposit and the length of your lock.</p>
          </div>
          <div className="flow-step">
            <h3>4. Spend or Hold</h3>
            <p>Use ZKN in-app for games. If you win, extra ZKN can be sold instantly. If you wait for your lock to expire, you can sell your initial reward or withdraw your ETH.</p>
          </div>
        </div>

        <blockquote className="highlight-box">
          <strong>The "Zen" Philosophy:</strong> Even if you lose your ZKN in-game, 
          your original ETH remains yours. Once the lock expires, you can withdraw 
          100% of your initial deposit. You only play with the "future yield."
        </blockquote>

        <h2>Technical Architecture</h2>
        <ul>
          <li>
            <strong>ZenbuLoot (Core):</strong> The brain of the project. It coordinates NFT purchases, mints ZKN rewards, and handles the gameplay APIs.
          </li>
          <li>
            <strong>Vault & Aave Strategy:</strong> Manages your ETH. It routes deposits into Aave to generate the yield that backs the ZKN tokens.
          </li>
          <li>
            <strong>Zenikane (ZKN):</strong> An ERC20-like token (4 decimals). Our protocol can mint/burn ZKN during gameplay, meaning <strong>no "Approve" transactions</strong> are needed to play.
          </li>
          <li>
            <strong>GameEngine:</strong> An independent logic layer that calculates math and house edges, ensuring fair and transparent on-chain gaming.
          </li>
        </ul>

        <h2>Economic Rules</h2>
        <ul>
          <li><strong>Yield Re-investment:</strong> After a lock ends, you can choose to "Re-invest." This keeps your ETH in Aave and mints a fresh batch of ZKN rewards for you.</li>
          <li><strong>Performance Fees:</strong> A small fee is deducted from minted ZKN rewards to sustain the protocol and pay for the underlying NFT infrastructure.</li>
          <li><strong>House Edge:</strong> Games include a slight edge (e.g., 1%). If you pick a 50% win chance, the engine adjusts it slightly (to ~49.5%) to ensure protocol long-term stability.</li>
        </ul>

        <h2>Security & UX</h2>
        <p>
          ZenbuLoot is designed for a seamless Web3 experience. By using internal mint/burn mechanics, 
          we’ve eliminated the need for constant "Token Approvals." Once your ETH is locked, 
          your focus stays on the game, not your wallet popups.
        </p>

        <div className="about-footer">
          <p>Questions? Reach out at <strong>cocdiller@gmail.com</strong></p>
        </div>
      </div>
    </div>
  );
}