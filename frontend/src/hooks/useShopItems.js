// hooks/useShopItems.js
import { useState, useEffect } from "react";
import { toast } from "react-toastify";

export function useShopItems(fetchAvailableItemTypes, connected) {
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState(null);

  useEffect(() => {
    const loadItems = async () => {
      if (!connected) return;
      
      setItemsLoading(true);
      setItemsError(null);
      
      try {
        const availableItems = await fetchAvailableItemTypes();
        setItems(availableItems);
      } catch (err) {
        console.error("Failed to load items:", err);
        setItemsError("Failed to load items from contract");
        toast.error("Failed to load items from contract");
      } finally {
        setItemsLoading(false);
      }
    };

    loadItems();
  }, [fetchAvailableItemTypes, connected]);

  return { items, itemsLoading, itemsError, setItems };
}