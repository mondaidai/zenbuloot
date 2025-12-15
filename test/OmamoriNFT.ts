import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = (await network.connect() as any);

describe("OmamoriNFT", function () {
    let omamori: any;
    let owner: any;
    let player: any;
    let otherPlayer: any;
    let authorizedUser: any;

    beforeEach(async function () {
        [owner, player, otherPlayer, authorizedUser] = await ethers.getSigners();
        const OmamoriNFT = await ethers.getContractFactory("OmamoriNFT");
        omamori = await OmamoriNFT.deploy();
        await omamori.waitForDeployment();
        
        // Add authorized user for testing
        await omamori.connect(owner).addAuthorized(authorizedUser.address);
    });

    // ===== CORE FUNCTIONALITY TESTS =====

    it("Should allow owner to add an item type", async function () {
        const itemData = {
            name: "Lucky Charm",
            defaultUses: 3,
            imageURI: "ipfs://dummy",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 * 24 * 60 * 60, // 30 days in seconds
            maxLockDuration: 365 * 24 * 60 * 60, // 365 days in seconds
            price: ethers.parseEther("1"),
            apr: 500, // 5% in basis points
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 1
        };

        await omamori.connect(owner).addItemType(itemData);

        const typeId = 1n;
        const itemType = await omamori.getItemType(typeId);
        expect(itemType.name).to.equal("Lucky Charm");
        expect(itemType.availableInShop).to.be.true;
        expect(itemType.defaultUses).to.equal(3);
    });

    it("Should mint an item to a player", async function () {
        const itemData = {
            name: "Lucky Charm",
            defaultUses: 3,
            imageURI: "ipfs://dummy",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("1"),
            apr: 500,
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 1
        };

        await omamori.connect(owner).addItemType(itemData);
        const typeId = 1n;

        await expect(omamori.connect(authorizedUser).mintItem(player.address, typeId))
            .to.emit(omamori, "MintedItem")
            .withArgs(1n, typeId, player.address);

        const tokenId = 1n;
        const [playerItem, itemType] = await omamori.getItemInfo(tokenId);
        expect(playerItem.usesLeft).to.equal(3);
        expect(playerItem.typeId).to.equal(typeId);
        expect(itemType.name).to.equal("Lucky Charm");
    });

    it("Should allow authorized user to consume an item", async function () {
        const itemData = {
            name: "Lucky Charm",
            defaultUses: 2,
            imageURI: "ipfs://dummy",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("1"),
            apr: 500,
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 1
        };

        await omamori.connect(owner).addItemType(itemData);
        const typeId = 1n;

        await omamori.connect(authorizedUser).mintItem(player.address, typeId);
        const tokenId = 1n;

        // Consume the item as authorized user
        await omamori.connect(authorizedUser).consumeItem(tokenId);

        // Verify state changes
        const [finalItem] = await omamori.getItemInfo(tokenId);
        expect(finalItem.usesLeft).to.equal(1);
        expect(finalItem.consumed).to.be.false;
    });

    it("Should mark item as consumed after all uses are spent", async function () {
        const itemData = {
            name: "Lucky Charm",
            defaultUses: 1,
            imageURI: "ipfs://dummy",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("1"),
            apr: 500,
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 1
        };

        await omamori.connect(owner).addItemType(itemData);
        const typeId = 1n;

        await omamori.connect(authorizedUser).mintItem(player.address, typeId);
        const tokenId = 1n;

        await omamori.connect(authorizedUser).consumeItem(tokenId);

        const [playerItem] = await omamori.getItemInfo(tokenId);
        expect(playerItem.consumed).to.be.true;
        expect(playerItem.usesLeft).to.equal(0);
    });

    it("Should not allow non-authorized user to consume item", async function () {
        const itemData = {
            name: "Lucky Charm",
            defaultUses: 1,
            imageURI: "ipfs://dummy",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("1"),
            apr: 500,
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 1
        };

        await omamori.connect(owner).addItemType(itemData);
        const typeId = 1n;

        await omamori.connect(authorizedUser).mintItem(player.address, typeId);
        const tokenId = 1n;

        await expect(omamori.connect(player).consumeItem(tokenId))
            .to.be.revertedWith("Not authorized");
    });

    it("Should prevent consuming expired items", async function () {
        const currentBlock = await ethers.provider.getBlock('latest');
        const currentTimestamp = currentBlock?.timestamp || Math.floor(Date.now() / 1000);

        const itemData = {
            name: "Lucky Charm",
            defaultUses: 1,
            imageURI: "ipfs://dummy",
            retired: false,
            availableInShop: true,
            expiresAt: BigInt(currentTimestamp - 10),
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("1"),
            apr: 500,
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 1
        };

        await omamori.connect(owner).addItemType(itemData);
        const typeId = 1n;

        await omamori.connect(authorizedUser).mintItem(player.address, typeId);
        const tokenId = 1n;

        await expect(omamori.connect(authorizedUser).consumeItem(tokenId))
            .to.be.revertedWith("Expired");
    });

    it("Should not mint retired items", async function () {
        const itemData = {
            name: "Lucky Charm",
            defaultUses: 1,
            imageURI: "ipfs://dummy",
            retired: true,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("1"),
            apr: 500,
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 1
        };

        await omamori.connect(owner).addItemType(itemData);
        const typeId = 1n;

        await expect(omamori.connect(authorizedUser).mintItem(player.address, typeId))
            .to.be.revertedWith("Item not available");
    });

    it("Should not mint items not available in shop", async function () {
        const itemData = {
            name: "Lucky Charm",
            defaultUses: 1,
            imageURI: "ipfs://dummy",
            retired: false,
            availableInShop: false,
            expiresAt: 0,
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("1"),
            apr: 500,
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 1
        };

        await omamori.connect(owner).addItemType(itemData);
        const typeId = 1n;

        await expect(omamori.connect(authorizedUser).mintItem(player.address, typeId))
            .to.be.revertedWith("Item not available");
    });

    // ===== EDGE CASE TESTS =====

    it("Should handle items with zero uses (permanent items)", async function () {
        const itemData = {
            name: "Permanent Lucky Charm",
            defaultUses: 0, // Zero means permanent/unlimited uses
            imageURI: "ipfs://permanent",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("1"),
            apr: 500,
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 1
        };

        await omamori.connect(owner).addItemType(itemData);
        await omamori.connect(authorizedUser).mintItem(player.address, 1n);

        // Permanent items should be consumable multiple times without being marked as consumed
        await omamori.connect(authorizedUser).consumeItem(1n);

        const [playerItemAfterFirstUse] = await omamori.getItemInfo(1n);
        expect(playerItemAfterFirstUse.usesLeft).to.equal(0); // Stays at 0
        expect(playerItemAfterFirstUse.consumed).to.be.false; // Never gets consumed

        // Should be able to consume again (permanent item)
        await omamori.connect(authorizedUser).consumeItem(1n);
        await omamori.connect(authorizedUser).consumeItem(1n);
        await omamori.connect(authorizedUser).consumeItem(1n);

        const [playerItemAfterMultipleUses] = await omamori.getItemInfo(1n);
        expect(playerItemAfterMultipleUses.usesLeft).to.equal(0); // Still 0
        expect(playerItemAfterMultipleUses.consumed).to.be.false; // Still not consumed
    });

    it("Should handle items with expiration in future", async function () {
        const currentBlock = await ethers.provider.getBlock('latest');
        const futureTimestamp = (currentBlock?.timestamp || 0) + 100000;

        const itemData = {
            name: "Future Expiry Item",
            defaultUses: 1,
            imageURI: "ipfs://dummy",
            retired: false,
            availableInShop: true,
            expiresAt: BigInt(futureTimestamp),
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("1"),
            apr: 500,
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 1
        };

        await omamori.connect(owner).addItemType(itemData);
        await omamori.connect(authorizedUser).mintItem(player.address, 1n);

        // Should work since not expired yet
        await omamori.connect(authorizedUser).consumeItem(1n);

        const [playerItem] = await omamori.getItemInfo(1n);
        expect(playerItem.usesLeft).to.equal(0);
        expect(playerItem.consumed).to.be.true;
    });

    // ===== ACCESS CONTROL TESTS =====

    it("Should not allow non-owner to call admin functions", async function () {
        const itemData = {
            name: "Test Item",
            defaultUses: 1,
            imageURI: "ipfs://dummy",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("1"),
            apr: 500,
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 1
        };

        await expect(omamori.connect(player).addItemType(itemData))
            .to.be.reverted;

        await expect(omamori.connect(player).setItemAvailableInShop(1, true))
            .to.be.reverted;

        await expect(omamori.connect(player).retireItemType(1))
            .to.be.reverted;
    });

    // ===== MULTIPLE ITEMS & BOUNDARY TESTS =====

    it("Should handle multiple item types correctly", async function () {
        const item1 = {
            name: "Common Item",
            defaultUses: 5,
            imageURI: "ipfs://common",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("0.1"),
            apr: 300,
            minInvestment: ethers.parseEther("0.01"),
            strategyId: 1
        };

        const item2 = {
            name: "Rare Item",
            defaultUses: 1,
            imageURI: "ipfs://rare",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("1"),
            apr: 800,
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 2
        };

        await omamori.connect(owner).addItemType(item1);
        await omamori.connect(owner).addItemType(item2);

        const type1 = await omamori.getItemType(1n);
        const type2 = await omamori.getItemType(2n);

        expect(type1.name).to.equal("Common Item");
        expect(type2.name).to.equal("Rare Item");
        expect(type1.defaultUses).to.equal(5);
        expect(type2.defaultUses).to.equal(1);
    });

    it("Should correctly track sequential token IDs", async function () {
        const itemData = {
            name: "Test Item",
            defaultUses: 1,
            imageURI: "ipfs://dummy",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("1"),
            apr: 500,
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 1
        };

        await omamori.connect(owner).addItemType(itemData);

        await omamori.connect(authorizedUser).mintItem(player.address, 1n);
        await omamori.connect(authorizedUser).mintItem(player.address, 1n);
        await omamori.connect(authorizedUser).mintItem(player.address, 1n);

        expect(await omamori.ownerOf(1n)).to.equal(player.address);
        expect(await omamori.ownerOf(2n)).to.equal(player.address);
        expect(await omamori.ownerOf(3n)).to.equal(player.address);

        const [item1] = await omamori.getItemInfo(1n);
        const [item2] = await omamori.getItemInfo(2n);
        const [item3] = await omamori.getItemInfo(3n);

        expect(item1.typeId).to.equal(1n);
        expect(item2.typeId).to.equal(1n);
        expect(item3.typeId).to.equal(1n);
    });

    // ===== STATE TRANSITION TESTS =====

    it("Should correctly update retired and available states", async function () {
        const itemData = {
            name: "Test Item",
            defaultUses: 1,
            imageURI: "ipfs://dummy",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("1"),
            apr: 500,
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 1
        };

        await omamori.connect(owner).addItemType(itemData);

        await omamori.connect(owner).retireItemType(1n);
        let itemType = await omamori.getItemType(1n);
        expect(itemType.retired).to.be.true;
        expect(itemType.availableInShop).to.be.false;
    });

    it("Should handle item availability changes", async function () {
        const itemData = {
            name: "Test Item",
            defaultUses: 1,
            imageURI: "ipfs://dummy",
            retired: false,
            availableInShop: false,
            expiresAt: 0,
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("1"),
            apr: 500,
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 1
        };

        await omamori.connect(owner).addItemType(itemData);

        // Should not be able to mint when not available
        await expect(omamori.connect(authorizedUser).mintItem(player.address, 1n))
            .to.be.revertedWith("Item not available");

        // Make available and should be able to mint
        await omamori.connect(owner).setItemAvailableInShop(1n, true);
        await omamori.connect(authorizedUser).mintItem(player.address, 1n);

        // Make unavailable again
        await omamori.connect(owner).setItemAvailableInShop(1n, false);
        await expect(omamori.connect(authorizedUser).mintItem(player.address, 1n))
            .to.be.revertedWith("Item not available");
    });

    // ===== ERROR MESSAGE & VALIDATION TESTS =====

    it("Should validate item name requirement", async function () {
        await expect(omamori.connect(owner).addItemType({
            name: "",
            defaultUses: 1,
            imageURI: "ipfs://dummy",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("1"),
            apr: 500,
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 1
        })).to.be.revertedWith("Name required");
    });

    it("Should provide specific error messages for non-existent items", async function () {
        await expect(omamori.getItemType(999n))
            .to.be.revertedWith("Invalid typeId");

        await expect(omamori.connect(authorizedUser).mintItem(player.address, 999n))
            .to.be.revertedWith("Invalid typeId");

        await expect(omamori.connect(owner).setItemAvailableInShop(999n, true))
            .to.be.revertedWith("Invalid typeId");

        await expect(omamori.connect(owner).retireItemType(999n))
            .to.be.revertedWith("Invalid typeId");
    });

    it("Should prevent double consumption", async function () {
        const itemData = {
            name: "Test Item",
            defaultUses: 1,
            imageURI: "ipfs://dummy",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("1"),
            apr: 500,
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 1
        };

        await omamori.connect(owner).addItemType(itemData);
        await omamori.connect(authorizedUser).mintItem(player.address, 1n);

        await omamori.connect(authorizedUser).consumeItem(1n);
        await expect(omamori.connect(authorizedUser).consumeItem(1n))
            .to.be.revertedWith("Already consumed");
    });

    // ===== BURN FUNCTIONALITY TEST =====

    it("Should allow burning consumed items", async function () {
        const itemData = {
            name: "Test Item",
            defaultUses: 1,
            imageURI: "ipfs://dummy",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("1"),
            apr: 500,
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 1
        };

        await omamori.connect(owner).addItemType(itemData);
        await omamori.connect(authorizedUser).mintItem(player.address, 1n);
        
        // Consume first
        await omamori.connect(authorizedUser).consumeItem(1n);
        
        // Then burn
        await omamori.connect(authorizedUser).burn(1n);
        
        // Verify token is burned
        await expect(omamori.ownerOf(1n)).to.be.reverted;
    });

    // ===== COMPREHENSIVE FLOW TEST =====

    it("Should handle complete item lifecycle", async function () {
        const itemData = {
            name: "Lifecycle Item",
            defaultUses: 2,
            imageURI: "ipfs://lifecycle",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 * 24 * 60 * 60,
            maxLockDuration: 365 * 24 * 60 * 60,
            price: ethers.parseEther("1"),
            apr: 500,
            minInvestment: ethers.parseEther("0.1"),
            maxInvestment: ethers.parseEther("10"),
            strategyId: 1
        };

        await omamori.connect(owner).addItemType(itemData);

        await omamori.connect(authorizedUser).mintItem(player.address, 1n);

        const [initialItem] = await omamori.getItemInfo(1n);
        expect(initialItem.usesLeft).to.equal(2);
        expect(initialItem.consumed).to.be.false;

        await omamori.connect(authorizedUser).consumeItem(1n);
        const [afterFirstUse] = await omamori.getItemInfo(1n);
        expect(afterFirstUse.usesLeft).to.equal(1);
        expect(afterFirstUse.consumed).to.be.false;

        await omamori.connect(authorizedUser).consumeItem(1n);
        const [afterSecondUse] = await omamori.getItemInfo(1n);
        expect(afterSecondUse.usesLeft).to.equal(0);
        expect(afterSecondUse.consumed).to.be.true;

        await expect(omamori.connect(authorizedUser).consumeItem(1n))
            .to.be.revertedWith("Already consumed");

        await omamori.connect(owner).retireItemType(1n);
        const itemType = await omamori.getItemType(1n);
        expect(itemType.retired).to.be.true;

        await expect(omamori.connect(authorizedUser).mintItem(player.address, 1n))
            .to.be.revertedWith("Item not available");
    });
});