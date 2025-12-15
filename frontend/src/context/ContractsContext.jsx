import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import ZenbuLootABI from "@/contracts/ZenbuLoot.json";
import VaultABI from "@/contracts/Vault.json";
import ZenikaneABI from "@/contracts/Zenikane.json";
import OmamoriNFTABI from "@contracts/OmamoriNFT.json";
import { ZENBU_LOOT_ADDRESS, VAULT_ADDRESS, ZENIKANE_ADDRESS, OMAMORINFT_ADDRESS } from "@config/contracts";

export const ContractsContext = createContext();
export const useContracts = () => useContext(ContractsContext);

export const ContractsProvider = ({ children }) => {
    const providerRef = useRef(null);
    const lootRef = useRef(null);
    const vaultRef = useRef(null);
    const zknRef = useRef(null);
    const omamoriRef = useRef(null);

    const [ready, setReady] = useState(false);

    useEffect(() => {
        const init = async () => {
            if (!window.ethereum) return;
            setReady(false);

            const provider = new ethers.BrowserProvider(window.ethereum);
            providerRef.current = provider;

            lootRef.current = new ethers.Contract(ZENBU_LOOT_ADDRESS, ZenbuLootABI.abi, provider);
            vaultRef.current = new ethers.Contract(VAULT_ADDRESS, VaultABI.abi, provider);
            zknRef.current = new ethers.Contract(ZENIKANE_ADDRESS, ZenikaneABI.abi, provider);
            omamoriRef.current = new ethers.Contract(OMAMORINFT_ADDRESS, OmamoriNFTABI.abi, provider);

            setReady(true);
        };

        init();
    }, []);

    const getSigner = async () => providerRef.current?.getSigner();

    const getContractWithSigner = async (contractRef) => {
        const signer = await getSigner();
        if (!signer || !contractRef.current) return null;

        // Connect the existing contract instance to the signer
        return contractRef.current.connect(signer);
    };


    return (
        <ContractsContext.Provider
            value={{
                providerRef,
                lootRef,
                vaultRef,
                zknRef,
                omamoriRef,
                getSigner,
                getContractWithSigner,
                ready,   // true if contracts are ready
            }}
        >
            {ready ? children : <div>Loading contracts...</div>}
        </ContractsContext.Provider>
    );
};
