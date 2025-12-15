// Types.sol - No changes needed, structure is perfect
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

struct ItemType {
    string name;
    uint16 defaultUses;
    string imageURI;
    bool retired;
    bool availableInShop;
    uint256 expiresAt;
    uint256 minLockDuration;
    uint256 maxLockDuration;
    uint256 price;
    uint32 apr;                 // for example 500 (5% in basis points)
    uint256 minInvestment;
    uint256 maxInvestment;
    uint256 strategyId;
}

struct PlayerItem {
    uint256 typeId;
    uint16 usesLeft;
    uint256 expiresAt;
    bool consumed;
}

struct GameResult {
    bool win;
    uint256 zknReward;
    uint256 droppedItemTypeId;
}
struct FeeCollectedState {
    uint256 gameFee;            // House edge on games (ZKN)
    uint256 performanceFee;     // Yield generation (ZKN)
}
struct FeeSettings {
    uint16 nftPurchaseFee;     // One-time NFT buys
    uint16 zknBuyFee;          // ZKN token purchases
    uint16 zknSellFee;         // ZKN token sales
    uint16 gameFee;            // House edge on games (ZKN)
    uint16 performanceFee;     // Yield generation (ZKN)
}
