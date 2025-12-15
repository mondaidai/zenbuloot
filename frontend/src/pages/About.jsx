import "@styles/about.css";

export function About() {
  return (
    <div className="about-container">
      <div className="about-inner">
        <h1 className="about-title">About ZenbuLoot</h1>
        <p>
          ZenbuLoot combines NFT-backed items, on-chain yield strategies, and
          gamified mechanics to create an interactive investment experience.
          Each NFT type represents an investment product (an "item type") with
          associated APR, lock rules, and strategy allocation. Users invest ETH
          tied to an NFT and receive ZKN (Zenikane) tokens as rewards.
        </p>

        <h2>Architecture Overview</h2>
        <p>
          The system is implemented as a set of smart contracts plus a React
          frontend. Key contracts:
        </p>
        <ul>
          <li>
            <strong>ZenbuLoot</strong> (core): coordinates investments, mints and
            locks ZKN rewards, handles NFT purchases, and exposes gameplay APIs.
          </li>
          <li>
            <strong>Zenikane (ZKN)</strong>: ERC20-like token (4 decimals) used
            for rewards and gameplay. The token allows the ZenbuLoot contract to
            mint and burn tokens as part of economic flows.
          </li>
          <li>
            <strong>Vault</strong>: manages ETH allocations to yield strategies
            and provides functions like `invest`, `relockETH` and `getTotalHarvestableYield`.
          </li>
          <li>
            <strong>GameEngine</strong>: independent engine that encapsulates
            game math and the house edge. The frontend calls the engine via
            ZenbuLoot's `playGame` API.
          </li>
          <li>
            <strong>OmamoriNFT</strong>: minting and item metadata; NFTs link
            investments to item types (APR, min/max lock, price, strategy).
          </li>
        </ul>

        <h2>How It Works (User Flow)</h2>
        <ol>
          <li>
            <strong>Buy or own an NFT item</strong>: NFTs represent an
            investment slot (a tokenId / item type) you must own to invest.
          </li>
          <li>
            <strong>Invest ETH</strong>: invest ETH against an NFT item for a
            chosen duration. The protocol mints ZKN rewards based on APR and
            locks them according to item rules. A performance fee (in ZKN) is
            collected on minted rewards.
          </li>
          <li>
            <strong>Relock / Reinvest</strong>: ETH locks can be consolidated
            or relocked via the Vault; ZenbuLoot's `reInvestETH` flow mints
            additional ZKN rewards when relocking and reapplies fees.
          </li>
          <li>
            <strong>Play games</strong>: use ZKN to play on-chain games via
            `playGame`. The GameEngine adjusts win probability by a house edge
            and returns rewards; ZenbuLoot mints or burns ZKN accordingly.
          </li>
          <li>
            <strong>Withdraw</strong>: claim unlocked ZKN or withdraw ETH
            according to the vault/strategy rules and supply of available funds.
          </li>
        </ol>

        <h2>Tokenomics & Fees</h2>
        <p>
          ZenbuLoot defines a compact fee structure (stored in `FeeSettings`):
        </p>
        <ul>
          <li><strong>NFT purchase fee</strong> (ETH) — charged on shop purchases.</li>
          <li><strong>ZKN buy / sell fees</strong> (ETH) — applied when buying/selling ZKN.</li>
          <li><strong>Game fee</strong> (ZKN) — the house edge is used by the GameEngine to adjust win probability; rewards and burns are performed by ZenbuLoot.</li>
          <li><strong>Performance fee</strong> (ZKN) — deducted from minted ZKN rewards and tracked for later withdrawal by the owner.</li>
        </ul>
        <p>
          Fees are tracked separately for ETH and ZKN (so the contract can
          correctly account for withdrawable balances). Performance fees are
          minted as ZKN and recorded in `collectedFees`.
        </p>

        <h2>Security & UX Notes</h2>
        <ul>
          <li>
            <strong>No ERC-20 approval needed for gameplay:</strong> the ZKN
            token grants the ZenbuLoot contract permission to mint/burn on
            behalf of the protocol. That avoids the typical approve/transferFrom
            UX step for playing games.
          </li>
          <li>
            <strong>House edge behaviour:</strong> the GameEngine applies a
            multiplicative house edge to the selected win probability (e.g.
            1% house edge reduces a chosen 50% to 49.5%). The frontend
            displays the chosen chance and can show the adjusted probability
            and payout to keep users informed.
          </li>
          <li>
            <strong>Limits and safeguards:</strong> functions like unlocking and
            relocking include checks (max locks, duration bounds) to prevent
            abuse and ensure predictable gas behavior.
          </li>
        </ul>

        <h2>Developer Notes</h2>
        <p>
          The frontend exposes hooks for common flows (`useInvestments`,
          `useHistory`, `usePickAChanceLogic`) which wrap contract calls and
          local UI state. If you extend the app, reuse these hooks to keep
          logic consistent across pages (fee settings, profit calc, lock
          fetching).
        </p>

        <h2>Contact</h2>
        <p>
          For questions or integrations, email <strong>team@zenbuloot.xyz</strong>.
        </p>
      </div>
    </div>
  );
}
