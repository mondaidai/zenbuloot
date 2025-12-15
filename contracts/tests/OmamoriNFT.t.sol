// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import { OmamoriNFT } from "../OmamoriNFT.sol";
import { Test } from "forge-std/Test.sol";
import { ItemType, PlayerItem } from "../Types.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

contract OmamoriNFTTest is Test {
    OmamoriNFT omamori;
    address owner = address(0x1);
    address player = address(0x2);
    address otherPlayer = address(0x3);
    address authorizedUser = address(0x4);

    function setUp() public {
        vm.startPrank(owner);
        omamori = new OmamoriNFT();
        omamori.addAuthorized(authorizedUser); // Add authorized user for testing
        vm.stopPrank();
    }

    function test_InitialState() public view {
        require(omamori.nextTypeId() == 1, "Initial nextTypeId should be 1");
        require(omamori.nextTokenId() == 1, "Initial nextTokenId should be 1");
    }

    function test_AddItemType() public {
        vm.startPrank(owner);

        ItemType memory item = ItemType({
            name: "Lucky Charm",
            defaultUses: 3,
            imageURI: "ipfs://test",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 days,
            maxLockDuration: 365 days,
            price: 1 ether,
            apr: 500, // 5%
            minInvestment: 0.1 ether,
            maxInvestment: 10 ether,
            strategyId: 1
        });

        uint256 typeId = omamori.addItemType(item);
        require(typeId == 1, "First item type should have ID 1");

        ItemType memory retrievedItem = omamori.getItemType(typeId);
        require(keccak256(bytes(retrievedItem.name)) == keccak256(bytes("Lucky Charm")), "Item name should match");
        require(retrievedItem.defaultUses == 3, "Default uses should match");
        require(retrievedItem.availableInShop == true, "Item should be available in shop");

        vm.stopPrank();
    }

    function test_AddItemType_OnlyOwner() public {
        ItemType memory item = ItemType({
            name: "Lucky Charm",
            defaultUses: 3,
            imageURI: "ipfs://test",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 days,
            maxLockDuration: 365 days,
            price: 1 ether,
            apr: 500,
            minInvestment: 0.1 ether,
            maxInvestment: 10 ether,
            strategyId: 1
        });

        vm.startPrank(player);
        vm.expectRevert();
        omamori.addItemType(item);
        vm.stopPrank();
    }

    function test_AddItemType_NameRequired() public {
        vm.startPrank(owner);

        ItemType memory item = ItemType({
            name: "",
            defaultUses: 3,
            imageURI: "ipfs://test",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 days,
            maxLockDuration: 365 days,
            price: 1 ether,
            apr: 500,
            minInvestment: 0.1 ether,
            maxInvestment: 10 ether,
            strategyId: 1
        });

        vm.expectRevert("Name required");
        omamori.addItemType(item);

        vm.stopPrank();
    }

    function test_MintItem() public {
        vm.startPrank(owner);

        ItemType memory item = ItemType({
            name: "Lucky Charm",
            defaultUses: 3,
            imageURI: "ipfs://test",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 days,
            maxLockDuration: 365 days,
            price: 1 ether,
            apr: 500,
            minInvestment: 0.1 ether,
            maxInvestment: 10 ether,
            strategyId: 1
        });

        uint256 typeId = omamori.addItemType(item);

        // Mint as authorized user (not owner)
        vm.stopPrank();
        vm.startPrank(authorizedUser);
        omamori.mintItem(player, typeId);

        require(omamori.ownerOf(1) == player, "Token should be minted to player");

        (PlayerItem memory playerItem, ItemType memory itemType) = omamori.getItemInfo(1);
        require(playerItem.usesLeft == 3, "Uses left should match default uses");
        require(playerItem.consumed == false, "Item should not be consumed initially");
        require(keccak256(bytes(itemType.name)) == keccak256(bytes("Lucky Charm")), "Item type name should match");

        vm.stopPrank();
    }

    function test_MintItem_NonExistentType() public {
        vm.startPrank(authorizedUser);
        vm.expectRevert("Invalid typeId");
        omamori.mintItem(player, 999);
        vm.stopPrank();
    }

    function test_MintItem_RetiredItem() public {
        vm.startPrank(owner);

        ItemType memory item = ItemType({
            name: "Lucky Charm",
            defaultUses: 3,
            imageURI: "ipfs://test",
            retired: true,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 days,
            maxLockDuration: 365 days,
            price: 1 ether,
            apr: 500,
            minInvestment: 0.1 ether,
            maxInvestment: 10 ether,
            strategyId: 1
        });

        uint256 typeId = omamori.addItemType(item);
        vm.stopPrank();

        vm.startPrank(authorizedUser);
        vm.expectRevert("Item not available");
        omamori.mintItem(player, typeId);
        vm.stopPrank();
    }

    function test_MintItem_NotAvailableInShop() public {
        vm.startPrank(owner);

        ItemType memory item = ItemType({
            name: "Lucky Charm",
            defaultUses: 3,
            imageURI: "ipfs://test",
            retired: false,
            availableInShop: false,
            expiresAt: 0,
            minLockDuration: 30 days,
            maxLockDuration: 365 days,
            price: 1 ether,
            apr: 500,
            minInvestment: 0.1 ether,
            maxInvestment: 10 ether,
            strategyId: 1
        });

        uint256 typeId = omamori.addItemType(item);
        vm.stopPrank();

        vm.startPrank(authorizedUser);
        vm.expectRevert("Item not available");
        omamori.mintItem(player, typeId);
        vm.stopPrank();
    }

    function test_ConsumeItem() public {
        vm.startPrank(owner);

        ItemType memory item = ItemType({
            name: "Lucky Charm",
            defaultUses: 2,
            imageURI: "ipfs://test",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 days,
            maxLockDuration: 365 days,
            price: 1 ether,
            apr: 500,
            minInvestment: 0.1 ether,
            maxInvestment: 10 ether,
            strategyId: 1
        });

        uint256 typeId = omamori.addItemType(item);
        vm.stopPrank();

        vm.startPrank(authorizedUser);
        omamori.mintItem(player, typeId);
        omamori.consumeItem(1); // Consume as authorized user

        (PlayerItem memory playerItem, ) = omamori.getItemInfo(1);
        require(playerItem.usesLeft == 1, "Uses should decrease by 1");
        require(playerItem.consumed == false, "Item should not be consumed yet");

        vm.stopPrank();
    }

    function test_ConsumeItem_NotAuthorized() public {
        vm.startPrank(owner);

        ItemType memory item = ItemType({
            name: "Lucky Charm",
            defaultUses: 2,
            imageURI: "ipfs://test",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 days,
            maxLockDuration: 365 days,
            price: 1 ether,
            apr: 500,
            minInvestment: 0.1 ether,
            maxInvestment: 10 ether,
            strategyId: 1
        });

        uint256 typeId = omamori.addItemType(item);
        vm.stopPrank();

        vm.startPrank(authorizedUser);
        omamori.mintItem(player, typeId);
        vm.stopPrank();

        vm.startPrank(otherPlayer); // Not authorized
        vm.expectRevert("Not authorized");
        omamori.consumeItem(1);
        vm.stopPrank();
    }

    function test_ConsumeItem_AlreadyConsumed() public {
        vm.startPrank(owner);

        ItemType memory item = ItemType({
            name: "Lucky Charm",
            defaultUses: 1,
            imageURI: "ipfs://test",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 days,
            maxLockDuration: 365 days,
            price: 1 ether,
            apr: 500,
            minInvestment: 0.1 ether,
            maxInvestment: 10 ether,
            strategyId: 1
        });

        uint256 typeId = omamori.addItemType(item);
        vm.stopPrank();

        vm.startPrank(authorizedUser);
        omamori.mintItem(player, typeId);
        omamori.consumeItem(1); // Consume first time
        vm.expectRevert("Already consumed");
        omamori.consumeItem(1); // Try to consume again
        vm.stopPrank();
    }

    function test_ConsumeItem_Expired() public {
        vm.startPrank(owner);

        ItemType memory item = ItemType({
            name: "Lucky Charm",
            defaultUses: 1,
            imageURI: "ipfs://test",
            retired: false,
            availableInShop: true,
            expiresAt: block.timestamp + 1000, // future expiration
            minLockDuration: 30 days,
            maxLockDuration: 365 days,
            price: 1 ether,
            apr: 500,
            minInvestment: 0.1 ether,
            maxInvestment: 10 ether,
            strategyId: 1
        });

        uint256 typeId = omamori.addItemType(item);
        vm.stopPrank();

        vm.startPrank(authorizedUser);
        omamori.mintItem(player, typeId);
        vm.stopPrank();

        // Warp time forward to make it expired
        vm.warp(block.timestamp + 2000);

        vm.startPrank(authorizedUser);
        vm.expectRevert("Expired");
        omamori.consumeItem(1);
        vm.stopPrank();
    }

    function test_ConsumeItem_PermanentItem() public {
        vm.startPrank(owner);

        ItemType memory item = ItemType({
            name: "Permanent Charm",
            defaultUses: 0, // Permanent item (0 uses = infinite)
            imageURI: "ipfs://test",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 days,
            maxLockDuration: 365 days,
            price: 1 ether,
            apr: 500,
            minInvestment: 0.1 ether,
            maxInvestment: 10 ether,
            strategyId: 1
        });

        uint256 typeId = omamori.addItemType(item);
        vm.stopPrank();

        vm.startPrank(authorizedUser);
        omamori.mintItem(player, typeId);

        // Can consume multiple times (won't get consumed since usesLeft is 0)
        omamori.consumeItem(1);
        omamori.consumeItem(1);
        omamori.consumeItem(1);

        (PlayerItem memory playerItem, ) = omamori.getItemInfo(1);
        require(playerItem.usesLeft == 0, "Uses should remain 0");
        require(playerItem.consumed == false, "Permanent item should never be consumed");

        vm.stopPrank();
    }

    function test_RetireItemType() public {
        vm.startPrank(owner);

        ItemType memory item = ItemType({
            name: "Lucky Charm",
            defaultUses: 3,
            imageURI: "ipfs://test",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 days,
            maxLockDuration: 365 days,
            price: 1 ether,
            apr: 500,
            minInvestment: 0.1 ether,
            maxInvestment: 10 ether,
            strategyId: 1
        });

        uint256 typeId = omamori.addItemType(item);
        omamori.retireItemType(typeId);

        ItemType memory retrievedItem = omamori.getItemType(typeId);
        require(retrievedItem.retired == true, "Item should be retired");

        vm.stopPrank();
    }

    function test_SetItemAvailableInShop() public {
        vm.startPrank(owner);

        ItemType memory item = ItemType({
            name: "Lucky Charm",
            defaultUses: 3,
            imageURI: "ipfs://test",
            retired: false,
            availableInShop: false,
            expiresAt: 0,
            minLockDuration: 30 days,
            maxLockDuration: 365 days,
            price: 1 ether,
            apr: 500,
            minInvestment: 0.1 ether,
            maxInvestment: 10 ether,
            strategyId: 1
        });

        uint256 typeId = omamori.addItemType(item);

        // Should not be able to mint when not available
        vm.stopPrank();
        vm.startPrank(authorizedUser);
        vm.expectRevert("Item not available");
        omamori.mintItem(player, typeId);
        vm.stopPrank();

        // Make available
        vm.startPrank(owner);
        omamori.setItemAvailableInShop(typeId, true);
        vm.stopPrank();

        vm.startPrank(authorizedUser);
        omamori.mintItem(player, typeId);
        require(omamori.ownerOf(1) == player, "Should be able to mint after making available");
        vm.stopPrank();
    }

    function test_BurnConsumedItem() public {
        vm.startPrank(owner);

        ItemType memory item = ItemType({
            name: "Lucky Charm",
            defaultUses: 1,
            imageURI: "ipfs://test",
            retired: false,
            availableInShop: true,
            expiresAt: 0,
            minLockDuration: 30 days,
            maxLockDuration: 365 days,
            price: 1 ether,
            apr: 500,
            minInvestment: 0.1 ether,
            maxInvestment: 10 ether,
            strategyId: 1
        });

        uint256 typeId = omamori.addItemType(item);
        vm.stopPrank();

        vm.startPrank(authorizedUser);
        omamori.mintItem(player, typeId);
        omamori.consumeItem(1); // Consume to mark as consumed

        // Now burn the consumed item
        omamori.burn(1);

        // Verify token is burned
        vm.expectRevert("Token doesn't exist");
        omamori.ownerOf(1);

        vm.stopPrank();
    }

    function testFuzz_MultipleItems(uint8 count) public {
        vm.assume(count > 0 && count < 10); // Reasonable bounds

        vm.startPrank(owner);

        for (uint8 i = 0; i < count; i++) {
            ItemType memory item = ItemType({
                name: string(abi.encodePacked("Item ", Strings.toString(i))),
                defaultUses: i,
                imageURI: "ipfs://test",
                retired: false,
                availableInShop: true,
                expiresAt: 0,
                minLockDuration: 30 days,
                maxLockDuration: 365 days,
                price: 1 ether,
                apr: 500,
                minInvestment: 0.1 ether,
                maxInvestment: 10 ether,
                strategyId: i + 1
            });

            uint256 typeId = omamori.addItemType(item);
            require(typeId == i + 1, "Type IDs should be sequential");
        }

        require(omamori.nextTypeId() == count + 1, "Next type ID should be correct");
        vm.stopPrank();

        // Mint one of each type as authorized user
        vm.startPrank(authorizedUser);
        for (uint8 i = 1; i <= count; i++) {
            omamori.mintItem(player, i);
            require(omamori.ownerOf(i) == player, "Token should be minted to player");
        }
        vm.stopPrank();
    }
}
