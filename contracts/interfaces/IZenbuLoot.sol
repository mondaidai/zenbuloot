// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../Types.sol";

interface IZenbuLoot {
    function withdrawProfits(address to, uint256 amountZKN) external;

    /// @notice Buy ZKN with ETH
    function buyZKN() external payable;

    function reInvestETH(uint256[] memory lockIndexes, uint256 newDuration) external;

    function buyAndInvestOmamoriNFT(uint256 typeId, uint256 lockDuration) external payable;

    /// @notice Sell ZKN for ETH (burns ZKN)
    function sellZKN(uint256 amountZKN) external;

    function playGame(uint16 chances, uint256 betAmount) external returns (GameResult memory);

    receive() external payable;
}
