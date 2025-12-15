// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./interfaces/IVault.sol";
import "./OmamoriNFT.sol";
import "./Types.sol";
import "./BaseStrategy.sol";

contract Vault is Ownable, ReentrancyGuard {
    address public zenbuLoot;
    bool public initialized = false;

    function initialize(address _zenbuLoot) external onlyOwner {
        require(!initialized, "Vault already initialized");
        require(_zenbuLoot != address(0), "Zero address");
        zenbuLoot = _zenbuLoot;
        initialized = true;
    }

    modifier onlyAuthrized() {
        require((msg.sender == zenbuLoot) || (msg.sender == address(this)), "Not authorized");
        _;
    }

    OmamoriNFT public immutable omm;

    struct ETHLock {
        uint256 amount;
        uint256 lockEnd;
        bool claimed;
        uint256 tokenId;
        address strategyContract;
    }
    mapping(address => ETHLock[]) public ETHLocks;

    mapping(address => uint256) public totalLockedETH;
    mapping(address => uint256) public availableETH;
    mapping(uint256 => address) public strategyContracts;
    uint256[] public registeredStrategyIds; // strategy IDs

    event ETHDeposited(address indexed user, uint256 amount);
    event ETHWithdrawn(uint256 indexed tokenId, address indexed user, uint256 amount);
    event StrategyInvested(uint256 indexed tokenId, uint256 strategyId, uint256 amount);
    event StrategyWithdrawn(uint256 indexed tokenId, uint256 strategyId, uint256 amount);
    event YieldHarvested(uint256 indexed tokenId, uint256 yieldAmount);

    constructor(address _omm) Ownable(msg.sender) {
        require(_omm != address(0), "Zero omm");
        omm = OmamoriNFT(payable(_omm));
    }

    function withdrawETH(uint256[] memory lockIndexes, bool toVault) external nonReentrant {
        address user = msg.sender;
        require(lockIndexes.length > 0, "No indexes");

        uint256 firstIndex = lockIndexes[0];
        require(firstIndex < ETHLocks[user].length, "Invalid index");

        ETHLock storage first = ETHLocks[user][firstIndex];
        require(!first.claimed, "Already claimed");
        require(block.timestamp >= first.lockEnd, "Not ended");

        uint256 tokenId = first.tokenId;
        address strat = first.strategyContract;
        require(strat != address(0), "Strategy not registered");

        uint256 totalAmount = 0;

        // Aggregate all locks, ensure validity
        for (uint256 i = 0; i < lockIndexes.length; i++) {
            uint256 idx = lockIndexes[i];
            require(idx < ETHLocks[user].length, "Invalid index");

            ETHLock storage lock = ETHLocks[user][idx];

            require(!lock.claimed, "Already claimed");
            require(block.timestamp >= lock.lockEnd, "Not ended");
            require(lock.tokenId == tokenId, "Different tokenId");

            totalAmount += lock.amount;
            lock.claimed = true;
        }

        require(totalAmount > 0, "Nothing to withdraw");

        // Withdraw only ONCE from the strategy
        uint256 withdrawn = BaseStrategy(strat).withdraw(totalAmount);

        totalLockedETH[user] -= withdrawn;

        emit ETHWithdrawn(tokenId, user, withdrawn);

        // Send the ETH to the user or to the vault
        if (toVault) {
            availableETH[user] += withdrawn;
            emit ETHDeposited(user, withdrawn);
            return;
        } else {
            // Send directly to user
            (bool sent, ) = user.call{ value: withdrawn }("");
            require(sent, "ETH transfer failed");
        }
    }

    function relockETH(address user, uint256[] memory lockIndexes, uint256 newDuration) external nonReentrant onlyAuthrized returns (uint256, uint256) {
        require(lockIndexes.length > 0, "No indexes");

        // Determine the tokenId from the first lock
        uint256 firstIndex = lockIndexes[0];
        require(firstIndex < ETHLocks[user].length, "Invalid index");

        ETHLock storage firstLock = ETHLocks[user][firstIndex];
        require(!firstLock.claimed, "Already claimed");
        require(block.timestamp >= firstLock.lockEnd, "Not ended");

        uint256 tokenId = firstLock.tokenId;

        // Check NFT ownership & item type info
        require(omm.ownerOf(tokenId) == user, "Not NFT owner");
        (, ItemType memory it) = omm.getItemInfo(tokenId);
        require(strategyContracts[it.strategyId] != address(0), "Strategy not registered");

        // Validate new duration
        require(newDuration >= it.minLockDuration, "Below min duration");
        require(newDuration <= it.maxLockDuration, "Above max duration");

        uint256 totalAmount = 0;

        // Collect all amounts + validate all locks share same tokenId
        for (uint256 i = 0; i < lockIndexes.length; i++) {
            uint256 index = lockIndexes[i];
            require(index < ETHLocks[user].length, "Invalid index");

            ETHLock storage old = ETHLocks[user][index];

            require(!old.claimed, "Already claimed");
            require(block.timestamp >= old.lockEnd, "Not ended");
            require(old.tokenId == tokenId, "Different tokenId");

            totalAmount += old.amount;

            old.claimed = true;
        }

        // Validate consolidated amount
        require(totalAmount >= it.minInvestment, "Below min invest");
        require(totalAmount <= it.maxInvestment, "Above max invest");

        // Create ONE new lock with total amount and store the strategy address
        ETHLocks[user].push(
            ETHLock({
                amount: totalAmount,
                lockEnd: block.timestamp + newDuration,
                claimed: false,
                tokenId: tokenId,
                strategyContract: strategyContracts[it.strategyId]
            })
        );
        return (totalAmount, tokenId);
    }

    function lockETH(address user, uint256 tokenId, uint256 lockDuration, uint256 amount) internal {
        require(omm.ownerOf(tokenId) == user, "Not NFT owner");
        (, ItemType memory it) = omm.getItemInfo(tokenId);
        require(strategyContracts[it.strategyId] != address(0), "Strategy not registered");
        require(amount >= it.minInvestment, "Amount below min investment");
        require(amount <= it.maxInvestment, "Amount below min investment");
        require(lockDuration >= it.minLockDuration, "Lock duration below min");
        require(lockDuration <= it.maxLockDuration, "Lock duration above max");
        // store the strategy address that this lock will be invested into
        ETHLocks[user].push(
            ETHLock({
                amount: amount,
                lockEnd: block.timestamp + lockDuration,
                claimed: false,
                tokenId: tokenId,
                strategyContract: strategyContracts[it.strategyId]
            })
        );
        totalLockedETH[user] += amount;
    }

    // deposit msg.value when amount == 0, else deposit amount from availableETH
    function invest(address user, uint256 tokenId, uint256 lockDuration, uint256 amount) external payable nonReentrant onlyAuthrized {
        require(omm.ownerOf(tokenId) == user, "Not NFT owner");
        (, ItemType memory it) = omm.getItemInfo(tokenId);
        require(strategyContracts[it.strategyId] != address(0), "Strategy not registered");
        address strategyAddr = strategyContracts[it.strategyId];
        require(strategyAddr != address(0), "Strategy not registered");
        availableETH[user] += msg.value;
        if (amount > 0) {
            require(availableETH[user] >= amount, "Insufficient ETH to invest");
            BaseStrategy(strategyAddr).invest{ value: amount }();
            lockETH(user, tokenId, lockDuration, amount);
            availableETH[user] -= amount;
        }
    }

    function withdrawAvailableETH(uint256 amount) external nonReentrant {
        require(availableETH[msg.sender] >= amount, "Insufficient available ETH");
        availableETH[msg.sender] -= amount;
        (bool sent, ) = msg.sender.call{ value: amount }("");
        require(sent, "ETH transfer failed");
    }

    function withdrawFromStrategy(uint256 tokenId) external nonReentrant {}

    function harvestStrategy(uint256 strategyId) external nonReentrant onlyAuthrized {
        address strategyAddr = strategyContracts[strategyId];
        require(strategyAddr != address(0), "Strategy not registered");

        // Call strategy-specific yield harvest function
        uint256 harvestedAmount = BaseStrategy(strategyAddr).harvestYield();

        require(harvestedAmount > 0, "No yield to harvest");

        // Transfer harvested ETH to msg.sender (Vault or ZenbuLoot)
        (bool sent, ) = msg.sender.call{ value: harvestedAmount }("");
        require(sent, "ETH transfer failed");
    }

    function harvestAllStrategies() external nonReentrant onlyAuthrized returns (uint256 totalHarvested) {
        for (uint256 i = 0; i < registeredStrategyIds.length; i++) {
            uint256 strategyId = registeredStrategyIds[i];
            address strategyAddr = strategyContracts[strategyId];
            if (strategyAddr != address(0)) {
                try BaseStrategy(strategyAddr).harvestYield() returns (uint256 amount) {
                    totalHarvested += amount;
                } catch {
                    // Strategy harvest failed, continue with next
                }
            }
        }

        // Transfer all harvested ETH to caller
        if (totalHarvested > 0) {
            (bool sent, ) = msg.sender.call{ value: totalHarvested }("");
            require(sent, "ETH transfer failed");
        }
    }

    function getLocksRange(address user, uint256 start, uint256 end) public view returns (ETHLock[] memory) {
        require(start <= end, "Invalid range");
        require(end <= ETHLocks[user].length, "Range out of bounds");

        uint256 length = end - start;
        ETHLock[] memory locks = new ETHLock[](length);

        for (uint256 i = 0; i < length; i++) {
            locks[i] = ETHLocks[user][start + i];
        }

        return locks;
    }

    function getStrategyIds() external view returns (uint256[] memory) {
        return registeredStrategyIds;
    }

    function registerStrategy(uint256 strategyId, address strategyContract) external onlyOwner {
        bool isNew = strategyContracts[strategyId] == address(0);
        strategyContracts[strategyId] = strategyContract;
        if (isNew) {
            registeredStrategyIds.push(strategyId);
        }
    }

    function getLockLength(address user) external view returns (uint256) {
        return ETHLocks[user].length;
    }

    function getAvailableETH(address user) external view returns (uint256) {
        return availableETH[user];
    }

    function getTotalHarvestableYield() external view returns (uint256 totalHarvestable) {
        for (uint256 i = 0; i < registeredStrategyIds.length; i++) {
            uint256 strategyId = registeredStrategyIds[i];
            address strategyAddr = strategyContracts[strategyId];
            if (strategyAddr != address(0)) {
                totalHarvestable += BaseStrategy(strategyAddr).getHarvestableYield();
            }
        }
        return totalHarvestable;
    }

    function getRiskAdjustedMultiplier(uint256 strategyId) public view returns (uint256) {
        address strategyAddr = strategyContracts[strategyId];
        require(strategyAddr != address(0), "Strategy not registered");
        return BaseStrategy(strategyAddr).riskMultiplier();
    }

    receive() external payable {}
}
