// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
contract Zenikane is ERC20, Ownable {
    address public ownerContract;
    bool initialized = false;
    function initialize(address _ownerContract) external onlyOwner{
        require(!initialized, "Already initialized");
        require(_ownerContract != address(0), "Zero address");
        ownerContract = _ownerContract;
        initialized = true;
    }
    constructor() ERC20("Zenikane", "ZKN") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return 4;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == ownerContract, "Not authorized");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(msg.sender == ownerContract, "Not authorized");
        _burn(from, amount);
    }
}