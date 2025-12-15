// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IZenbuLoot.sol";
import "./Types.sol";
import "./interfaces/IGameEngine.sol";

contract GameEngine is IGameEngine, Ownable {
    
    event Initialized(address indexed zenbuLoot);
    event HouseEdgeUpdated(uint256 newHouseEdge);
    event ZenbuLootUpdated(address indexed newZenbuLoot);

    uint256 public constant PRECISION = 10000;
    uint256 public houseEdge = 100; // 1% house edge

    address public zenbuLoot;
    bool public initialized = false;

    constructor() Ownable(msg.sender) {}

    function initialize(address _zenbuLoot) external onlyOwner {
        require(!initialized, "Already initialized");
        require(_zenbuLoot != address(0), "Zero address");
        zenbuLoot = _zenbuLoot;
        initialized = true;
        emit Initialized(_zenbuLoot);
    }

    modifier onlyAuthorized() {
        require(msg.sender == zenbuLoot, "Not authorized");
        _;
    }

    function setHouseEdge(uint256 newHouseEdge) external onlyAuthorized {
        require(newHouseEdge <= 500, "House edge too high"); // Max 5%
        require(newHouseEdge >= 10, "House edge too low"); // Min 0.1%
        houseEdge = newHouseEdge;
        emit HouseEdgeUpdated(newHouseEdge);
    }

    function _generateRandomNumber() internal view returns (uint256) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                blockhash(block.number > 0 ? block.number - 1 : block.number),
                block.timestamp,
                block.prevrandao,
                address(this),
                msg.sender // Include sender for more entropy
            )
        );
        return uint256(hash);
    }

    function calculateFairReward(uint256 betAmount, uint16 chancePercent) internal pure returns (uint256) {
        require(chancePercent > 0 && chancePercent < PRECISION, "Invalid chance percent");
        require(betAmount > 0, "Invalid bet amount");
        return (betAmount * PRECISION) / chancePercent;
    }

    function getAdjustedWinProbability(uint16 chancePercent) internal view returns (uint16) {
        require(chancePercent > 0 && chancePercent < PRECISION, "Invalid chance percent");
        // Reduce win probability by current house edge
        uint256 adjusted = (uint256(chancePercent) * (PRECISION - houseEdge)) / PRECISION;
        require(adjusted > 0, "Adjusted probability too low");
        return uint16(adjusted);
    }

    function pickAChance(uint16 chancePercent, uint256 betAmount) external view returns (GameResult memory) {
        require(chancePercent > 0 && chancePercent < PRECISION, "Invalid chance percent");
        require(betAmount > 0, "Invalid bet amount");

        uint16 adjustedChance = getAdjustedWinProbability(chancePercent);

        bool win = ((_generateRandomNumber() % PRECISION)) < adjustedChance;
        uint256 reward = 0;

        if (win) {
            reward = calculateFairReward(betAmount, chancePercent);
        }

        return GameResult({ win: win, zknReward: reward, droppedItemTypeId: 0 });
    }
}
