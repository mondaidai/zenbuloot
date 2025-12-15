// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Types.sol";

contract OmamoriNFT is ERC721, Ownable, ReentrancyGuard {
    mapping(uint256 => ItemType) public itemTypes;
    uint256 public nextTypeId = 1;

    mapping(uint256 => PlayerItem) public playerItems;
    uint256 public nextTokenId = 1;

    mapping(address => bool) public authorized;

    // ============ ENHANCED EVENTS ============
    event AuthorizedAdded(address indexed account);
    event AuthorizedRemoved(address indexed account);
    event MintedItem(uint256 indexed tokenId, uint256 indexed typeId, address indexed player);
    event ItemConsumed(uint256 indexed tokenId, uint256 usesLeft);
    event ItemBurned(uint256 indexed tokenId);
    
    // NEW EVENTS
    event ItemTypeAdded(
        uint256 indexed typeId, 
        string name, 
        uint256 price, 
        uint32 apr,
        uint256 minLockDuration,
        uint256 maxLockDuration,
        bool availableInShop
    );
    event ItemTypeUpdated(uint256 indexed typeId, bool availableInShop);
    event ItemTypeRetired(uint256 indexed typeId);
    event ItemTypeExpired(uint256 indexed typeId);
    event TransferWithData(
        address indexed from, 
        address indexed to, 
        uint256 indexed tokenId,
        uint256 typeId
    );

    constructor() ERC721("OmamoriNFT", "OMM") Ownable(msg.sender) {}

    modifier onlyAuthorized() {
        require(owner() == msg.sender || authorized[msg.sender], "Not authorized");
        _;
    }

    // ============ NFT MANAGEMENT ============

    function mintItem(address player, uint256 typeId) external onlyAuthorized returns (uint256) {
        require(typeId > 0 && typeId < nextTypeId, "Invalid typeId");

        ItemType memory t = itemTypes[typeId];
        require(t.availableInShop && !t.retired, "Item not available");
        require(t.expiresAt == 0 || t.expiresAt > block.timestamp, "Item type expired");

        uint256 tokenId = nextTokenId++;
        _mint(player, tokenId);

        playerItems[tokenId] = PlayerItem({ 
            typeId: typeId, 
            usesLeft: t.defaultUses, 
            expiresAt: t.expiresAt, 
            consumed: false 
        });

        emit MintedItem(tokenId, typeId, player);
        return tokenId;
    }

    function consumeItem(uint256 tokenId) external onlyAuthorized {
        PlayerItem storage p = playerItems[tokenId];

        require(!p.consumed, "Already consumed");
        require(p.expiresAt == 0 || block.timestamp < p.expiresAt, "Expired");

        if (p.usesLeft > 0) {
            p.usesLeft--;
            if (p.usesLeft == 0) {
                p.consumed = true;
            }
        }
        
        emit ItemConsumed(tokenId, p.usesLeft);
    }

    // Override transfer to include typeId in event
    function _update(address to, uint256 tokenId, address auth) 
        internal 
        override 
        returns (address) 
    {
        address from = _ownerOf(tokenId);
        address previousOwner = super._update(to, tokenId, auth);
        
        if (from != address(0)) {
            PlayerItem memory p = playerItems[tokenId];
            emit TransferWithData(from, to, tokenId, p.typeId);
        }
        
        return previousOwner;
    }

    // ============ ITEM TYPE MANAGEMENT ============

    function addItemType(ItemType calldata item) external onlyOwner returns (uint256) {
        require(bytes(item.name).length > 0, "Name required");
        require(item.minLockDuration <= item.maxLockDuration && item.minLockDuration > 0, "Invalid lock duration");
        require(item.minInvestment <= item.maxInvestment && item.minInvestment > 0, "Invalid lock duration");
        require(item.price > 0, "Price must be positive");
        require(item.apr <= 10000, "APR too high"); // Max 100%

        uint256 id = nextTypeId++;
        itemTypes[id] = item;
        
        // EMIT ENHANCED EVENT
        emit ItemTypeAdded(
            id, 
            item.name, 
            item.price, 
            item.apr,
            item.minLockDuration,
            item.maxLockDuration,
            item.availableInShop
        );
        return id;
    }

    function setItemAvailableInShop(uint256 typeId, bool v) external onlyOwner {
        require(typeId > 0 && typeId < nextTypeId, "Invalid typeId");
        require(!itemTypes[typeId].retired, "Retired");

        if (v && itemTypes[typeId].expiresAt != 0 && itemTypes[typeId].expiresAt < block.timestamp) {
            emit ItemTypeExpired(typeId);
            revert("Item type expired");
        }

        itemTypes[typeId].availableInShop = v;
        emit ItemTypeUpdated(typeId, v);
    }

    function retireItemType(uint256 typeId) external onlyOwner {
        require(typeId > 0 && typeId < nextTypeId, "Invalid typeId");
        itemTypes[typeId].retired = true;
        itemTypes[typeId].availableInShop = false;
        emit ItemTypeRetired(typeId);
    }

    function burn(uint256 tokenId) external onlyAuthorized {
        require(_ownerOf(tokenId) != address(0), "Token doesn't exist");
        PlayerItem storage p = playerItems[tokenId];
        require(p.consumed, "Not consumed");

        _burn(tokenId);
        delete playerItems[tokenId];
        emit ItemBurned(tokenId);
    }

    // ============ VIEW FUNCTIONS ============

    function getItemType(uint256 typeId) external view returns (ItemType memory) {
        require(typeId > 0 && typeId < nextTypeId, "Invalid typeId");
        return itemTypes[typeId];
    }

    function getItemInfo(uint256 tokenId) external view returns (PlayerItem memory, ItemType memory) {
        require(_ownerOf(tokenId) != address(0), "Doesn't exist");
        PlayerItem memory p = playerItems[tokenId];
        ItemType memory t = itemTypes[p.typeId];
        return (p, t);
    }

    function addAuthorized(address a) external onlyOwner {
        require(a != address(0), "Zero address");
        authorized[a] = true;
        emit AuthorizedAdded(a);
    }

    function removeAuthorized(address a) external onlyOwner {
        require(authorized[a], "Not authorized");
        authorized[a] = false;
        emit AuthorizedRemoved(a);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token doesn't exist");
        PlayerItem memory p = playerItems[tokenId];
        ItemType memory t = itemTypes[p.typeId];
        return t.imageURI;
    }

    // Helper function to check if item type exists and is available
    function isItemAvailable(uint256 typeId) external view returns (bool) {
        if (typeId == 0 || typeId >= nextTypeId) return false;
        ItemType memory t = itemTypes[typeId];
        return t.availableInShop && !t.retired && 
               (t.expiresAt == 0 || t.expiresAt > block.timestamp);
    }
}