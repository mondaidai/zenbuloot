// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IOmamoriNFT.sol";
import "./Types.sol";
import "./ZenbuLoot.sol";

contract Zenikane is ERC20, Ownable, ReentrancyGuard {

    error RangeOutOfBounds();
    error InvalidRange();    
    error AmountTooSmall();
    error NoLocksSpecified();
    error TooManyLocks();
    error NoClaimableZKN();
    error InvalidLockIndex();
    error InsufficientZKNBalance();
    error InvalidFeeRange(string message);

    event ZKNLocked(address indexed user, uint256 tokenId, uint256 lockIndex, uint256 amount, uint256 lockEnd);
    event ZKNUnlocked(address indexed user, uint256 amount);

    struct ZKNLock {
        uint256 amount;
        uint256 lockEnd;
        bool claimed;
        uint256 tokenId;
    }
    mapping(address => ZKNLock[]) public userLocks;
    mapping(address => uint256) public userTotalZKNLocked;

    ZenbuLoot public ownerContract;
    bool initialized = false;
    function initialize(address _ownerContract) external onlyOwner{
        require(!initialized, "Already initialized");
        require(_ownerContract != address(0), "Zero address");
        ownerContract = ZenbuLoot(payable(_ownerContract));
        initialized = true;
    }
    constructor() ERC20("Zenikane", "ZKN") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return 4;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == address(ownerContract), "Not authorized");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(msg.sender == address(ownerContract), "Not authorized");
        _burn(from, amount);
    }



    function lockZKN(address user, uint256 tokenId, uint256 amount, uint256 duration) external returns (uint256) {
        require(msg.sender == address(ownerContract), "Not authorized");
        if (tokenId != 0) {
            // tokenId of 0 means lock for selling
            (, ItemType memory it) = ownerContract.omm().getItemInfo(tokenId);
            if (amount == 0) revert AmountTooSmall();
            if (duration < it.minLockDuration) revert InvalidFeeRange("Duration too short");
            if (duration > it.maxLockDuration) revert InvalidFeeRange("Duration too long");
        }
        if (balanceOf(user) < amount) revert InsufficientZKNBalance();

        uint256 lockIndex = userLocks[user].length;
        userLocks[user].push(ZKNLock({ amount: amount, lockEnd: block.timestamp + duration, claimed: false, tokenId: tokenId }));
        userTotalZKNLocked[user] += amount;
        emit ZKNLocked(user, tokenId, lockIndex, amount, block.timestamp + duration);
        return lockIndex;
    }
    function _isLockClaimable(ZKNLock memory lock) internal view returns (bool) {
        return lock.amount > 0 && !lock.claimed && block.timestamp >= lock.lockEnd;
    }

    function unlockZKN(uint256[] calldata lockIndexes) external nonReentrant {
        if (lockIndexes.length == 0) revert NoLocksSpecified();
        if (lockIndexes.length > 50) revert TooManyLocks();

        uint256 totalToUnlock = 0;

        for (uint256 i = 0; i < lockIndexes.length; i++) {
            uint256 lockIndex = lockIndexes[i];
            if (lockIndex >= userLocks[msg.sender].length) revert InvalidLockIndex();

            ZKNLock storage lock = userLocks[msg.sender][lockIndex];
            if (_isLockClaimable(lock)) {
                totalToUnlock += lock.amount;
                lock.claimed = true;
            }
        }

        if (totalToUnlock == 0) revert NoClaimableZKN();
        userTotalZKNLocked[msg.sender] -= totalToUnlock;
        emit ZKNUnlocked(msg.sender, totalToUnlock);
    }

    function getLocksRange(address user, uint256 start, uint256 end) public view returns (ZKNLock[] memory) {
        if (start > end) revert InvalidRange();
        if (end > userLocks[user].length) revert RangeOutOfBounds();

        uint256 length = end - start;
        ZKNLock[] memory locks = new ZKNLock[](length);

        for (uint256 i = 0; i < length; i++) {
            locks[i] = userLocks[user][start + i];
        }

        return locks;
    }
    function getLockLength(address user) external view returns (uint256) {
        return userLocks[user].length;
    }
    function singleUnlockZKN(address user, uint256 lockIndex, bool success) external {
        require(msg.sender == address(ownerContract), "Not authorized");
        if (lockIndex >= userLocks[user].length) return;

        ZKNLock storage lock = userLocks[user][lockIndex];
        uint256 originalAmount = lock.amount;

        lock.claimed = true;
        userTotalZKNLocked[user] -= originalAmount;

        if (!success) lock.amount = 0;

        emit ZKNUnlocked(user, originalAmount);
    }
    function getAvailableZKN(address user) public view returns (uint256) {
        uint256 totalBalance = balanceOf(user);
        uint256 locked = userTotalZKNLocked[user];
        return totalBalance > locked ? totalBalance - locked : 0;
    }

    // Override transfer to move locks to recipient
    function transfer(address to, uint256 amount) public override returns (bool) {
        _transferWithLocks(msg.sender, to, amount, new uint256[](0));
        return true;
    }

    // Override transferFrom to move locks to recipient
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        _transferWithLocks(from, to, amount, new uint256[](0));
        return true;
    }

    // Custom transfer function that allows specifying which locks to transfer
    function transferWithLocks(address to, uint256 amount, uint256[] calldata lockIndexes) external returns (bool) {
        _transferWithLocks(msg.sender, to, amount, lockIndexes);
        return true;
    }

    // transferFrom version with lock specification
    function transferFromWithLocks(address from, address to, uint256 amount, uint256[] calldata lockIndexes) external returns (bool) {
        _transferWithLocks(from, to, amount, lockIndexes);
        return true;
    }

    // Internal function to handle token transfer and lock ownership transfer
    function _transferWithLocks(address from, address to, uint256 amount, uint256[] memory lockIndexes) internal {
        // Call parent's _transfer for the actual token transfer
        _transfer(from, to, amount);
        
        uint256 remaining = amount;
        uint256 lockIndexPos = 0;
        
        // First, transfer unlocked tokens
        uint256 availableUnlocked = getAvailableZKN(from);
        uint256 transferUnlocked = remaining <= availableUnlocked ? remaining : availableUnlocked;
        remaining -= transferUnlocked;
        
        // Then transfer from specified locks in order
        while (remaining > 0 && lockIndexPos < lockIndexes.length) {
            uint256 lockIndex = lockIndexes[lockIndexPos];
            lockIndexPos++;
            
            if (lockIndex >= userLocks[from].length) continue;
            
            ZKNLock storage lock = userLocks[from][lockIndex];
            
            // Skip empty or already claimed locks
            if (lock.amount == 0 || lock.claimed) continue;
            
            // Calculate how much of this lock to transfer
            uint256 transferAmount = lock.amount <= remaining ? lock.amount : remaining;
            
            // Add lock to recipient
            userLocks[to].push(ZKNLock({
                amount: transferAmount,
                lockEnd: lock.lockEnd,
                claimed: false,
                tokenId: lock.tokenId
            }));
            
            // Reduce lock amount for sender
            lock.amount -= transferAmount;
            
            // Update total locked amounts
            userTotalZKNLocked[from] -= transferAmount;
            userTotalZKNLocked[to] += transferAmount;
            
            remaining -= transferAmount;
        }
    }
}