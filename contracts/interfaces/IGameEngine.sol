// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Types.sol"; // contains GameResult struct

interface IGameEngine {

    function pickAChance(uint16 chancePercent, uint256 betAmount) external view returns (GameResult memory);

    function setHouseEdge(uint256 newHouseEdge) external;
    
}
