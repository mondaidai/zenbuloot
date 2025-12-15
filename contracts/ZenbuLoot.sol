// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./interfaces/IGameEngine.sol";
import "./interfaces/IOmamoriNFT.sol";
import "./interfaces/IZenbuLoot.sol";
import "./interfaces/IVault.sol";
import "./Zenikane.sol";
import "./Types.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ZenbuLoot is Ownable, IZenbuLoot, ReentrancyGuard {
    error NoZKNTokensMinted();
    error InsufficientETH();
    error NotNFTOwner();
    error InvalidLockIndex();
    error NoClaimableZKN();
    error NoZKNTokensToMint();
    error InsufficientZKNBalance();
    error InsufficientContractETH();
    error ETHTransferFailed();
    error InvalidFeeRange(string feeType);
    error ItemNotAvailable();
    error AmountTooSmall();
    error NoLocksSpecified();
    error TooManyLocks();
    error InvalidRange();
    error RangeOutOfBounds();
    error GameEngineNotSet();
    error InvalidRewardFromEngine();
    error RefundFailed();
    error QueueFull();

    event ZKNUnlocked(address indexed user, uint256 totalClaimed);
    event ZKNLocked(address indexed user, uint256 tokenId, uint256 lockIndex, uint256 amount, uint256 lockEnd);
    event ZKNSold(address indexed seller, uint256 zknAmount, uint256 ethAmount);
    event ZKNBought(address indexed buyer, uint256 zknAmount, uint256 ethAmount);
    event ETHWithdrawn(address indexed to, uint256 amount);
    event OmamoriNFTPurchased(address indexed buyer, uint256 nftPrice, uint256 tokenId, uint256 investedAmount);
    event FeesUpdated(FeeSettings newFees);
    event FeeCollected(string feeType, uint256 amount, address from);
    event ProfitsWithdrawn(address indexed to, uint256 zknAmount);
    event ZKNPriceUpdated(uint256 newPrice, uint256 totalETHBacking, uint256 totalZKNSupply);

    event AppendedToQueue(address indexed user, uint256 amountETH);
    event SellSkippedUserNoZKN(address indexed user, uint256 amountZKN);
    event QueueProcessed(uint256 itemsProcessed, uint256 totalZKNSold, uint256 totalETHPaidOut);
    event HarvestFailed(string reason);

    struct QueueEntry {
        address user;
        uint256 amountETH;
        uint256 amountZKN;
        uint256 timestamp;
        uint256 lockIndex;
    }
    QueueEntry[] public sellQueue;
    uint256 public constant MAX_QUEUE_LENGTH = 10000;
    uint256 public constant QUEUE_EXPIRY_DURATION = 7 days;

    uint256 public ZKN_PRICE_IN_ETH = 5e13; // 0.00005 ETH
    uint256 public totalZKNFees; // Fees collected (ZKN)

    Zenikane public immutable zkn;
    IOmamoriNFT public immutable omm;
    IGameEngine public immutable gameEngine;
    IVault public immutable vault;

    FeeSettings public fees = FeeSettings(500, 0, 300, 100, 1500);
    FeeCollectedState public collectedFees; // Tracks collected fees

    struct ZKNLock {
        uint256 amount;
        uint256 lockEnd;
        bool claimed;
        uint256 tokenId;
    }
    mapping(address => ZKNLock[]) public userLocks;
    mapping(address => uint256) public userTotalZKNLocked;

    constructor(Zenikane _token, IOmamoriNFT _omm, IGameEngine _gameEngine, IVault _vault) Ownable(msg.sender) {
        zkn = _token;
        omm = _omm;
        gameEngine = _gameEngine;
        vault = _vault;
    }

    function setFees(FeeSettings calldata newFees) external onlyOwner {
        if (newFees.nftPurchaseFee < 100 || newFees.nftPurchaseFee > 2000) revert InvalidFeeRange("NFT");
        if (newFees.zknBuyFee > 200) revert InvalidFeeRange("ZKN buy");
        if (newFees.zknSellFee > 300) revert InvalidFeeRange("ZKN sell");
        if (newFees.gameFee > 500) revert InvalidFeeRange("Game");
        if (newFees.performanceFee > 500) revert InvalidFeeRange("Performance");

        fees = newFees;
        gameEngine.setHouseEdge(newFees.gameFee);
        emit FeesUpdated(newFees);
    }

    function setZKNPriceInETH() public {
        if (msg.sender != owner() && msg.sender != address(this)) {
            revert("Only owner or contract can call");
        }
        uint256 totalSupply = zkn.totalSupply();
        if (totalSupply == 0) revert NoZKNTokensMinted();
        uint256 totalETHBacking = vault.getTotalHarvestableYield() + address(this).balance;
        ZKN_PRICE_IN_ETH = (totalETHBacking * (10 ** zkn.decimals())) / totalSupply;
        emit ZKNPriceUpdated(ZKN_PRICE_IN_ETH, totalETHBacking, totalSupply);
    }

    function _isLockClaimable(ZKNLock memory lock) internal view returns (bool) {
        return lock.amount > 0 && !lock.claimed && block.timestamp >= lock.lockEnd;
    }

    function getAvailableZKN(address user) public view returns (uint256) {
        uint256 totalBalance = zkn.balanceOf(user);
        uint256 locked = userTotalZKNLocked[user];
        return totalBalance > locked ? totalBalance - locked : 0;
    }

    function withdrawProfits(address to, uint256 amountZKN) external onlyOwner {
        if (amountZKN > totalZKNFees) revert InsufficientZKNBalance();
        if (zkn.balanceOf(address(this)) < amountZKN) revert InsufficientZKNBalance();

        if (amountZKN > 0 && totalZKNFees > 0) {
            uint256 zknReductionRatio = (amountZKN * 1e18) / totalZKNFees;
            collectedFees.gameFee -= (collectedFees.gameFee * zknReductionRatio) / 1e18;
            collectedFees.performanceFee -= (collectedFees.performanceFee * zknReductionRatio) / 1e18;
            totalZKNFees -= amountZKN;
        }

        if (amountZKN > 0) {
            zkn.transfer(to, amountZKN);
        }

        emit ProfitsWithdrawn(to, amountZKN);
    }

    // deprecated
    function buyZKN() public payable nonReentrant {
        if (msg.value == 0) revert InsufficientETH();

        uint256 amountToMint = (msg.value * (10 ** zkn.decimals())) / ZKN_PRICE_IN_ETH;
        if (amountToMint == 0) revert AmountTooSmall();
        zkn.mint(msg.sender, amountToMint);

        emit ZKNBought(msg.sender, msg.value, amountToMint);
    }

    function investETH(uint256 tokenId, uint256 lockDuration, uint256 amount) external payable nonReentrant {
        if (omm.ownerOf(tokenId) != msg.sender) revert NotNFTOwner();

        // Calculate ZKN amount first (without fees)
        (, ItemType memory it) = omm.getItemInfo(tokenId);

        uint256 netZKNToMint = 0;
        // Check if user meets investment criteria
        if (vault.getAvailableETH(msg.sender) + msg.value >= amount) {
            omm.consumeItem(tokenId);
            uint256 grossZKNToMint = calculateZKNPotentialProfit(msg.value, lockDuration, it.apr, it.strategyId);
            uint256 performanceFeeZKN = (grossZKNToMint * fees.performanceFee) / 10000;
            netZKNToMint = grossZKNToMint - performanceFeeZKN;
            if (netZKNToMint == 0) revert NoZKNTokensToMint();
            collectedFees.performanceFee += performanceFeeZKN;
            totalZKNFees += performanceFeeZKN;
            emit FeeCollected("performance", performanceFeeZKN, msg.sender);
        }

        vault.invest{ value: msg.value }(msg.sender, tokenId, lockDuration, amount);

        if (netZKNToMint > 0) {
            zkn.mint(msg.sender, netZKNToMint);
            _lockZKN(msg.sender, tokenId, netZKNToMint, lockDuration);
        }
    }

    function calculateZKNPotentialProfit(uint256 amountETH, uint256 lockDuration, uint256 apr, uint256 strategyId) public view returns (uint256) {
        // Combine operations to save bytecode
        uint256 baseReward = (amountETH * apr * lockDuration * (10 ** zkn.decimals())) / (10000 * 365 days * ZKN_PRICE_IN_ETH);
        return (baseReward * vault.getRiskAdjustedMultiplier(strategyId)) / 10000;
    }

    function _lockZKN(address user, uint256 tokenId, uint256 amount, uint256 duration) internal returns (uint256) {
        if (tokenId != 0) {
            // tokenId of 0 means lock for selling
            (, ItemType memory it) = omm.getItemInfo(tokenId);
            if (amount == 0) revert AmountTooSmall();
            if (duration < it.minLockDuration) revert InvalidFeeRange("Duration too short");
            if (duration > it.maxLockDuration) revert InvalidFeeRange("Duration too long");
        }
        if (zkn.balanceOf(user) < amount) revert InsufficientZKNBalance();

        uint256 lockIndex = userLocks[user].length;
        userLocks[user].push(ZKNLock({ amount: amount, lockEnd: block.timestamp + duration, claimed: false, tokenId: tokenId }));
        userTotalZKNLocked[user] += amount;
        emit ZKNLocked(user, tokenId, lockIndex, amount, block.timestamp + duration);
        return lockIndex;
    }

    function _unlockZKNInternal(address user, uint256 lockIndex, bool success) internal {
        if (lockIndex >= userLocks[user].length) return;

        ZKNLock storage lock = userLocks[user][lockIndex];
        uint256 originalAmount = lock.amount;

        lock.claimed = true;
        userTotalZKNLocked[user] -= originalAmount;

        if (!success) lock.amount = 0;

        emit ZKNUnlocked(user, originalAmount);
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

    function buyAndInvestOmamoriNFT(uint256 typeId, uint256 lockDuration) public payable nonReentrant {
        ItemType memory it = omm.getItemType(typeId);
        if (!it.availableInShop) revert ItemNotAvailable();

        uint256 nftPrice = it.price;
        if (msg.value < nftPrice) revert InsufficientETH();

        // Mint NFT
        uint256 tokenId = omm.mintItem(msg.sender, typeId);

        uint256 excessAmount = msg.value - nftPrice;
        uint256 investedAmount = 0;

        if (excessAmount > 0) {
            // calculate APR-based ZKN reward
            uint256 grossZKN = calculateZKNPotentialProfit(excessAmount, lockDuration, it.apr, it.strategyId);

            uint256 perfFee = (grossZKN * fees.performanceFee) / 10000;
            uint256 netZKN = grossZKN - perfFee;

            if (netZKN == 0) revert NoZKNTokensToMint();

            collectedFees.performanceFee += perfFee;
            totalZKNFees += perfFee;
            emit FeeCollected("performance", perfFee, msg.sender);

            vault.invest{ value: excessAmount }(msg.sender, tokenId, lockDuration, excessAmount);

            zkn.mint(msg.sender, netZKN);
            _lockZKN(msg.sender, tokenId, netZKN, lockDuration);

            investedAmount = excessAmount;
        }

        emit OmamoriNFTPurchased(msg.sender, nftPrice, tokenId, investedAmount);
    }

    function processQueue(uint256 maxItems) external nonReentrant {
        uint256 length = sellQueue.length;
        if (length == 0) return;

        uint256 processed = 0;
        uint256 soldZKN = 0;
        uint256 totalETHPaidOut = 0;
        uint256 i = 0;
        bool burnSuccess;

        try vault.harvestAllStrategies() {} catch (bytes memory /*lowLevelData*/) {
            emit HarvestFailed("harvest failed (unknown reason)");
        }

        while (i < sellQueue.length && processed < maxItems) {
            QueueEntry memory entry = sellQueue[i];

            // Try to burn user's ZKN
            if (address(this).balance >= entry.amountETH) {
                try zkn.burn(entry.user, entry.amountZKN) {
                    burnSuccess = true;
                } catch {
                    burnSuccess = false;
                }
            } else {
                break;
            }

            if (burnSuccess) {
                // ETH payout can be sent because burn succeeded
                (bool sent, ) = entry.user.call{ value: entry.amountETH }("");
                if (!sent) {
                    // If ETH fails, revert entire process — ETH must be paid if tokens were burned
                    revert ETHTransferFailed();
                }
                soldZKN += entry.amountZKN;
                totalETHPaidOut += entry.amountETH;
                // unlock as consumed
                _unlockZKNInternal(entry.user, entry.lockIndex, true);

                emit ZKNSold(entry.user, entry.amountZKN, entry.amountETH);
            } else {
                // burn failed => user no longer owns ZKN => skip payout

                // unlock as expired/invalid
                _unlockZKNInternal(entry.user, entry.lockIndex, false);

                emit SellSkippedUserNoZKN(entry.user, entry.amountZKN);
            }

            // Remove queue entry by swapping and popping
            sellQueue[i] = sellQueue[sellQueue.length - 1];
            sellQueue.pop();

            processed++;
            // No increment of i, because we replaced current index with another entry
        }
        uint256 incentive = (soldZKN * fees.zknSellFee) / 10000 / 2; // %50 procents of all fees is incentive
        zkn.mint(msg.sender, incentive);
        setZKNPriceInETH();
        emit QueueProcessed(processed, soldZKN, totalETHPaidOut);
    }

    function sellZKN(uint256 amountZKN) external nonReentrant {
        if (amountZKN == 0) revert AmountTooSmall();
        if (zkn.balanceOf(msg.sender) < amountZKN) revert InsufficientZKNBalance();

        uint256 sellFeeZKN = (amountZKN * fees.zknSellFee) / 10000;
        uint256 userReceivesZKN = amountZKN - sellFeeZKN;

        uint256 userReceivesETH = (userReceivesZKN * ZKN_PRICE_IN_ETH) / (10 ** zkn.decimals());
        if (userReceivesETH == 0) revert AmountTooSmall(); // amount too small at current price

        if (address(this).balance >= userReceivesETH) {
            zkn.burn(msg.sender, amountZKN);

            (bool sent, ) = msg.sender.call{ value: userReceivesETH }("");
            if (!sent) revert ETHTransferFailed();

            emit ZKNSold(msg.sender, amountZKN, userReceivesETH);
        } else {
            // lock ZKN when putting into queue, to allow use spend ZKN in app while waiting
            uint256 lockId = _lockZKN(msg.sender, 0, amountZKN, QUEUE_EXPIRY_DURATION);

            // Queue for later processing
            if (sellQueue.length >= MAX_QUEUE_LENGTH) revert QueueFull();

            sellQueue.push(QueueEntry({ user: msg.sender, amountETH: userReceivesETH, amountZKN: amountZKN, timestamp: block.timestamp, lockIndex: lockId }));

            emit AppendedToQueue(msg.sender, userReceivesETH);
        }
    }

    function playGame(uint16 chances, uint256 betAmount) external nonReentrant returns (GameResult memory) {
        if (address(gameEngine) == address(0)) revert GameEngineNotSet();
        if (betAmount == 0) revert AmountTooSmall();
        // Ensure user has at least the declared betAmount (includes locked + available)
        if (zkn.balanceOf(msg.sender) < betAmount) revert InsufficientZKNBalance();

        // Ask engine for result - house edge is handled internally by GameEngine
        GameResult memory engineResult = gameEngine.pickAChance(chances, betAmount);

        if (engineResult.win) {
            // engine must return at least betAmount as reward
            if (engineResult.zknReward < betAmount) revert InvalidRewardFromEngine();
            // mint winnings minus the stake (betAmount was previously taken as stake)
            zkn.mint(msg.sender, engineResult.zknReward - betAmount);
        } else {
            // LOSS: burn betAmount from user, preferring available balance,
            // then consuming locked ZKN if needed.

            uint256 burnAmount = betAmount;

            // available = total balance minus locked tracked amount
            uint256 available = getAvailableZKN(msg.sender);
            uint256 locked = userTotalZKNLocked[msg.sender];

            if (available >= burnAmount) {
                // Burn fully from available balance
                zkn.burn(msg.sender, burnAmount);
            } else {
                // Burn all available first (if >0)
                if (available > 0) {
                    zkn.burn(msg.sender, available);
                }

                uint256 leftover = burnAmount - available;

                // Ensure we have enough locked to cover leftover
                if (locked < leftover) revert InsufficientZKNBalance();

                // Reduce locked accounting and burn the locked portion
                userTotalZKNLocked[msg.sender] = locked - leftover;
                zkn.burn(msg.sender, leftover);
            }
        }

        return engineResult;
    }

    // View function to check profit info
    function getProfitInfo() external view returns (uint256 totalZKNFeesCollected, uint256 withdrawableZKN, FeeCollectedState memory currentCollectedFees) {
        return (totalZKNFees, zkn.balanceOf(address(this)) >= totalZKNFees ? totalZKNFees : zkn.balanceOf(address(this)), collectedFees);
    }

    receive() external payable {
        buyZKN();
    }

    /*     function withdrawETH() external {
        // take ETH lock ids
        // take amount for locks
        // sum amount and request withdrawal from strategy (all locks must be same strategy)
        // remainers are locked in new lock for new lockDuration
        // ZKN are minted and locked
    } */
    function reInvestETH(uint256[] memory lockIndexes, uint256 newDuration) external {
        // Re-lock ETH and get the consolidated amount + correct tokenId
        (uint256 amount, uint256 tokenId) = vault.relockETH(msg.sender, lockIndexes, newDuration);

        // Safety: ensure they still own the NFT
        require(omm.ownerOf(tokenId) == msg.sender, "Not NFT owner");

        (, ItemType memory it) = omm.getItemInfo(tokenId);

        // Calculate ZKN rewards
        uint256 grossZKNToMint = calculateZKNPotentialProfit(amount, newDuration, it.apr, it.strategyId);

        uint256 performanceFeeZKN = (grossZKNToMint * fees.performanceFee) / 10000;
        uint256 netZKNToMint = grossZKNToMint - performanceFeeZKN;

        if (netZKNToMint == 0) revert NoZKNTokensToMint();

        // Accounting
        collectedFees.performanceFee += performanceFeeZKN;
        totalZKNFees += performanceFeeZKN;

        emit FeeCollected("performance", performanceFeeZKN, msg.sender);

        // Mint ZKN rewards
        zkn.mint(msg.sender, netZKNToMint);

        // Lock the rewarded ZKN using the SAME tokenId
        _lockZKN(msg.sender, tokenId, netZKNToMint, newDuration);
    }
}
