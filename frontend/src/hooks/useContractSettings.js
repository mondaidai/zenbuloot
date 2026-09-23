import { useState, useEffect } from "react";
import { useContracts } from "@/context/ContractsContext";

export const useContractSettings = () => {
  const { lootRef, zknRef, getSigner } = useContracts();

  const [price, setPrice] = useState(null);
  const [decimals, setDecimals] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      if (!lootRef.current || !zknRef.current) return;       // contracts not ready yet

      try {
        setLoading(true);

        const [priceBN, decimalsBN] = await Promise.all([
          lootRef.current.ZKN_PRICE_IN_ETH(),
          zknRef.current.decimals()
        ]);

        setPrice(priceBN);
        setDecimals(Number(decimalsBN));
        setError(null);
      } catch (e) {
        console.error("Failed to load settings:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [lootRef.current, zknRef.current, getSigner]);

  return { price, decimals, loading, error };
};
