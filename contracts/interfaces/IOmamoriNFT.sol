// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../Types.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IOmamoriNFT is IERC721 {
    function mintItem(address player, uint256 typeId) external returns (uint256);

    function consumeItem(uint256 tokenId) external;

    function addItemType(ItemType calldata item) external returns (uint256);

    function setItemAvailableInShop(uint256 typeId, bool v) external;

    function retireItemType(uint256 typeId) external;

    function getItemType(uint256 typeId) external view returns (ItemType memory);

    function getItemInfo(uint256 tokenId) external view returns (PlayerItem memory, ItemType memory);

    function isLockExpired(uint256 tokenId) external view returns (bool);

    // ============ AUTHORIZATION ============

    function addAuthorized(address a) external;

    function removeAuthorized(address a) external;

    function updateLockInfo(
        uint256 tokenId,
        uint256 newLockStart,
        uint256 newLockDuration,
        uint256 newPrincipal
    ) external;

    function updateInvestmentInfo(uint256 tokenId, uint256 investedAmount, uint256 lastHarvest) external;
}
