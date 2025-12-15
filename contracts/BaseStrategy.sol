// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

abstract contract BaseStrategy {
    address public vault;
    string public name;

    event Invested(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event YieldHarvested(address indexed to, uint256 amount);

    modifier onlyVault() {
        require(msg.sender == vault, "Only vault can call");
        _;
    }

    constructor(address _vault, string memory _name) {
        vault = _vault;
        name = _name;
    }

    function invest() external payable virtual onlyVault {
        _invest();
        emit Invested(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external virtual onlyVault returns (uint256) {
        uint256 withdrawn = _withdraw(amount);
        emit Withdrawn(msg.sender, withdrawn);
        return withdrawn;
    }

    /// @notice Harvest yield without touching principal
    function harvestYield() external virtual returns (uint256);

    // returns current harvestable yield amount
    function getHarvestableYield() external view virtual returns (uint256) {
        return 0;
    }

    function riskMultiplier() external view virtual returns (uint256) {
        return 10000; // Default 1x multiplier
    }

    function getBalance() external view virtual returns (uint256);

    function getAPY() external view virtual returns (uint256);

    function _invest() internal virtual;

    function _withdraw(uint256 amount) internal virtual returns (uint256);
}
