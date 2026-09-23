// hooks/useOmamoriNFT.js
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useContracts } from "@context/ContractsContext";
import { OMAMORINFT_ADDRESS } from "@config/contracts";
import OmamoriNFTABI from "@contracts/OmamoriNFT.json";
export const useOmamoriNFT = () => {
  const [contract, setContract] = useState(null);
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { omamoriRef } = useContracts();

  // Initialize provider and contract
  useEffect(() => {
    const init = async () => {
      try {
        // use provider from context
        if (omamoriRef.current) {
          setContract(omamoriRef.current);   // correct path
          setProvider(omamoriRef.current.runner); // optional
          return;
        }

        // fallback: manual creation
        const provider = window.ethereum
          ? new ethers.BrowserProvider(window.ethereum)
          : ethers.getDefaultProvider();

        const omamori = new ethers.Contract(
          OMAMORINFT_ADDRESS,
          OmamoriNFTABI.abi,
          provider
        );

        setProvider(provider);
        setContract(omamori);
      } catch (err) {
        console.error("Error initializing contract:", err);
        setError("Failed to initialize contract");
      }
    };

    init();
  }, [omamoriRef.current]);

  const fetchToken = useCallback(async (tokenId) => {
    if (!contract) {
      setError('Contract not initialized');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const [p, t] = await contract.getItemInfo(tokenId);

      // Format results into JS friendly structure
      return {
        tokenId,
        playerItem: {
          typeId: Number(p.typeId),
          createdAt: Number(p.createdAt),
          expiresAt: Number(p.expiresAt),
          usesLeft: Number(p.usesLeft),
          lockedUntil: Number(p.lockedUntil)
        },
        itemType: {
          typeId: Number(p.typeId),
          name: t.name,
          price: ethers.formatEther(t.price),
          apr: Number(t.apr),
          minLockDuration: Number(t.minLockDuration),
          maxLockDuration: Number(t.maxLockDuration),
          minInvestment: ethers.formatEther(t.minInvestment),
          maxInvestment: ethers.formatEther(t.maxInvestment),
          availableInShop: t.availableInShop,
          retired: t.retired,
          expiresAt: Number(t.expiresAt),
          imageURI: t.imageURI,
          defaultUses: Number(t.defaultUses),
          strategyId: Number(t.strategyId),
        }
      };
    } catch (err) {
      console.error("Failed to fetch token:", err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [contract]);

  // Fetch all item types
  const fetchAllItemTypes = useCallback(async () => {
    if (!contract) {
      setError('Contract not initialized');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const nextTypeId = await contract.nextTypeId();
      const typeCount = Number(nextTypeId);
      const types = [];

      for (let i = 1; i < typeCount; i++) {
        try {
          const itemType = await contract.getItemType(i);
          types.push({
            typeId: i,
            name: itemType.name,
            price: ethers.formatEther(itemType.price),
            apr: Number(itemType.apr),
            minLockDuration: Number(itemType.minLockDuration),
            maxLockDuration: Number(itemType.maxLockDuration),
            minInvestment: ethers.formatEther(itemType.minInvestment),
            maxInvestment: ethers.formatEther(itemType.maxInvestment),
            availableInShop: itemType.availableInShop,
            retired: itemType.retired,
            expiresAt: Number(itemType.expiresAt),
            imageURI: itemType.imageURI,
            defaultUses: Number(itemType.defaultUses),
            strategyId: Number(itemType.strategyId),
          });
        } catch (err) {
          console.warn(`Item type ${i} not found:`, err);
        }
      }

      return types;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [contract]);

  // Fetch only available item types
  const fetchAvailableItemTypes = useCallback(async () => {
    if (!contract) {
      setError('Contract not initialized');
      return [];
    }

    setLoading(true);
    try {
      const allTypes = await fetchAllItemTypes();
      const currentTimestamp = Math.floor(Date.now() / 1000);

      return allTypes.filter(type =>
        type.availableInShop &&
        !type.retired &&
        (type.expiresAt === 0 || type.expiresAt > currentTimestamp)
      );
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [contract, fetchAllItemTypes]);

  // Fetch specific item type
  const fetchItemType = useCallback(async (typeId) => {
    if (!contract) {
      setError('Contract not initialized');
      return null;
    }

    setLoading(true);
    try {
      const itemType = await contract.getItemType(typeId);
      return {
        typeId,
        name: itemType.name,
        price: ethers.formatEther(itemType.price),
        apr: Number(itemType.apr),
        minLockDuration: Number(itemType.minLockDuration),
        maxLockDuration: Number(itemType.maxLockDuration),
        minInvestment: parseEther(itemType.minInvestment),
        maxInvestment: parseEther(itemType.maxInvestment),
        availableInShop: itemType.availableInShop,
        retired: itemType.retired,
        expiresAt: Number(itemType.expiresAt),
        imageURI: itemType.imageURI,
        defaultUses: Number(t.defaultUses)
      };
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [contract]);

  // Check if item type is available
  const checkItemAvailability = useCallback(async (typeId) => {
    if (!contract) return false;

    try {
      return await contract.isItemAvailable(typeId);
    } catch (err) {
      setError(err.message);
      return false;
    }
  }, [contract]);

  return {
    // Data fetching functions
    fetchAllItemTypes,
    fetchAvailableItemTypes,
    fetchItemType,
    checkItemAvailability,
    fetchToken,

    // State
    loading,
    error,
    contract,
    provider
  };
};