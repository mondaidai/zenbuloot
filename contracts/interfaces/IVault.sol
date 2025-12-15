// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../Types.sol";

interface IVault {
    struct ETHLock {
        uint256 amount;
        uint256 lockEnd;
        bool claimed;
        uint256 tokenId;
    }

    function relockETH(address user, uint256[] memory lockIndexes, uint256 newDuration) external returns (uint256, uint256);

    function totalLockedETH(address user) external view returns (uint256);

    function availableETH(address user) external view returns (uint256);

    function strategyContracts(uint256 strategyId) external view returns (address);

    function registeredStrategyIds(uint256 index) external view returns (uint256);

    // Initialization
    function initializeVault(address _zenbuLoot) external;

    // ETH Management

    function invest(address user, uint256 tokenId, uint256 lockDuration, uint256 amount) external payable;

    function withdrawETH(uint256[] memory lockIndexes, bool toVault) external;

    function withdrawAvailableETH(uint256 amount) external;

    function withdrawFromStrategy(uint256 tokenId) external;

    // Strategy Management
    function harvestStrategy(uint256 strategyId) external;

    function harvestAllStrategies() external returns (uint256 totalHarvested);

    function registerStrategy(uint256 strategyId, address strategyContract) external;

    // View functions
    function getLocksRange(address user, uint256 start, uint256 end) external view returns (ETHLock[] memory);

    function getStrategyIds() external view returns (uint256[] memory);

    function getLockLength(address user) external view returns (uint256);

    function getAvailableETH(address user) external view returns (uint256);

    function getTotalHarvestableYield() external view returns (uint256);

    function getRiskAdjustedMultiplier(uint256 strategyId) external view returns (uint256);

    receive() external payable;
}
