// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "../BaseStrategy.sol";
import { IPool } from "@aave/core-v3/contracts/interfaces/IPool.sol";
import { DataTypes } from "@aave/core-v3/contracts/protocol/libraries/types/DataTypes.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWETH is IERC20 {
    function deposit() external payable;

    function withdraw(uint256 wad) external;
}

contract AaveStrategy is BaseStrategy {
    using SafeERC20 for IERC20;

    IPool public immutable aavePool;
    IERC20 public immutable aWETH; // aToken for WETH (used for balance reads)
    IWETH public immutable WETH;
    address public immutable wethAddress;

    // tracks principal (in ETH terms)
    uint256 public totalPrincipalETH;

    event InvestedToAave(address indexed from, uint256 amount);
    event WithdrawnFromAave(address indexed to, uint256 amount);
    event YieldHarvestedToVault(address indexed vault, uint256 amount);

    constructor(address _vault, address _aavePool, address _aWETH, address _wethAddress) BaseStrategy(_vault, "Aave ETH Strategy") {
        require(_vault != address(0), "zero vault");
        require(_aavePool != address(0), "zero pool");
        require(_aWETH != address(0), "zero aWETH");
        require(_wethAddress != address(0), "zero WETH");

        aavePool = IPool(_aavePool);
        aWETH = IERC20(_aWETH);
        WETH = IWETH(_wethAddress);
        wethAddress = _wethAddress;

        // Approve Aave pool to pull WETH when we call aavePool.supply(...)
        // We set a large allowance for convenience; for audits you can implement
        // the approve(0) -> approve(amount) pattern instead.
        IERC20(wethAddress).approve(_aavePool, type(uint256).max);
    }

    // ---------------------------- //
    //           INVEST             //
    // ---------------------------- //
    function _invest() internal override {
        require(msg.value > 0, "Zero ETH");

        uint256 amount = msg.value;

        // 1) Wrap ETH -> WETH
        WETH.deposit{ value: amount }();

        // 2) Quick sanity check
        require(IERC20(wethAddress).balanceOf(address(this)) >= amount, "WETH wrap failed");

        // 3) Supply WETH to Aave pool (this mints aWETH to this contract)
        // pool will transferFrom WETH from this contract, so allowance must be set
        aavePool.supply(wethAddress, amount, address(this), 0);

        // 4) Update principal only after successful supply
        totalPrincipalETH += amount;

        emit InvestedToAave(msg.sender, amount);
    }

    // ---------------------------- //
    //          WITHDRAW            //
    // ---------------------------- //
    function _withdraw(uint256 amount) internal override returns (uint256) {
        require(amount > 0, "Zero amount");

        uint256 currentTotalValue = getBalance();
        require(currentTotalValue > 0, "No funds");

        uint256 principalShare = (amount * totalPrincipalETH) / currentTotalValue;

        // Reduce principal before external calls
        if (principalShare >= totalPrincipalETH) {
            totalPrincipalETH = 0;
        } else {
            totalPrincipalETH -= principalShare;
        }

        // Ask Aave to withdraw
        uint256 withdrawn = aavePool.withdraw(wethAddress, amount, address(this));
        require(withdrawn >= amount, "Aave withdraw shortfall");

        // Unwrap the withdrawn WETH (unwrap EXACTLY ‘withdrawn’)
        WETH.withdraw(withdrawn);

        // Send ETH to vault
        (bool sent, ) = payable(vault).call{ value: withdrawn }("");
        require(sent, "ETH transfer to vault failed");

        emit WithdrawnFromAave(vault, withdrawn);

        return withdrawn;
    }

    // ---------------------------- //
    //         VIEW HELPERS         //
    // ---------------------------- //
    function getBalance() public view override returns (uint256) {
        // aToken.balanceOf already reflects user's current underlying amount for most Aave aTokens
        return aWETH.balanceOf(address(this));
    }

    function getAPY() external view override returns (uint256) {
        DataTypes.ReserveData memory reserve = aavePool.getReserveData(wethAddress);
        return reserve.currentLiquidityRate;
    }

    function harvestYield() external override onlyVault returns (uint256) {
        uint256 yield = this.getHarvestableYield();
        if (yield == 0) return 0;

        // Withdraw the yield amount (aavePool.withdraw returns the withdrawn amount)
        uint256 withdrawn = aavePool.withdraw(wethAddress, yield, address(this));
        require(withdrawn >= yield, "Aave withdraw failed");

        // Unwrap to ETH and forward to vault
        WETH.withdraw(yield);
        (bool sent, ) = payable(vault).call{ value: yield }("");
        require(sent, "ETH transfer to vault failed");

        emit YieldHarvestedToVault(vault, yield);
        return yield;
    }

    function getETHPerAWETH() public view returns (uint256) {
        DataTypes.ReserveData memory reserve = aavePool.getReserveData(wethAddress);
        return reserve.liquidityIndex;
    }

    function getHarvestableYield() external view override returns (uint256) {
        uint256 current = getBalance();
        return current > totalPrincipalETH ? current - totalPrincipalETH : 0;
    }

    function getStrategyInfo() external view returns (uint256 principalETH, uint256 currentValueETH, uint256 harvestableYieldETH, uint256 aWETHBalance) {
        principalETH = totalPrincipalETH;
        currentValueETH = getBalance();
        harvestableYieldETH = this.getHarvestableYield();
        aWETHBalance = aWETH.balanceOf(address(this));
    }

    function riskMultiplier() external pure override returns (uint256) {
        return 10000;
    }

    // Allow contract to receive ETH when unwrapping WETH
    receive() external payable {}
}
