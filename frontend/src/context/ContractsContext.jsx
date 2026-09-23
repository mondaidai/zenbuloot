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
    const [hasWallet, setHasWallet] = useState(true); // New state to track wallet existence

    useEffect(() => {
        const init = async () => {
            // 1. Check if the user has a provider (MetaMask, Rabby, etc.)
            if (!window.ethereum) {
                setHasWallet(false);
                return;
            }

            try {
                setReady(false);
                setHasWallet(true);

                // Initialize the provider
                const provider = new ethers.BrowserProvider(window.ethereum);
                providerRef.current = provider;

                // Initialize contract instances (Read-only initially)
                lootRef.current = new ethers.Contract(ZENBU_LOOT_ADDRESS, ZenbuLootABI.abi, provider);
                vaultRef.current = new ethers.Contract(VAULT_ADDRESS, VaultABI.abi, provider);
                zknRef.current = new ethers.Contract(ZENIKANE_ADDRESS, ZenikaneABI.abi, provider);
                omamoriRef.current = new ethers.Contract(OMAMORINFT_ADDRESS, OmamoriNFTABI.abi, provider);

                setReady(true);
            } catch (error) {
                console.error("Initialization error:", error);
                // If something goes wrong during init, we treat it as not ready
                setReady(false);
            }
        };

        init();

        // Optional: Listen for account changes or network changes
        if (window.ethereum) {
            window.ethereum.on("accountsChanged", () => window.location.reload());
            window.ethereum.on("chainChanged", () => window.location.reload());
        }
    }, []);

    const getSigner = async () => {
        if (!providerRef.current) return null;
        try {
            return await providerRef.current.getSigner();
        } catch (e) {
            console.error("User denied account access");
            return null;
        }
    };

    const getContractWithSigner = async (contractRef) => {
        const signer = await getSigner();
        if (!signer || !contractRef.current) return null;
        return contractRef.current.connect(signer);
    };

    // --- RENDER LOGIC ---

    // Scenario A: No MetaMask found
    if (!hasWallet) {
        return (
            <div style={{ 
                display: 'flex', flexDirection: 'column', alignItems: 'center', 
                justifyContent: 'center', height: '100vh', textAlign: 'center', fontFamily: 'sans-serif' 
            }}>
                <h1>MetaMask Required</h1>
                <p>We couldn't find a Web3 wallet. Please install MetaMask to use ZenbuLoot.</p>
                <a 
                    href="https://metamask.io/download/" 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ padding: '10px 20px', backgroundColor: '#f6851b', color: 'white', borderRadius: '5px', textDecoration: 'none', fontWeight: 'bold' }}
                >
                    Install MetaMask
                </a>
            </div>
        );
    }

    // Scenario B: Wallet found, but still setting up contracts
    if (!ready) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div>Connecting to Blockchain...</div>
            </div>
        );
    }

    // Scenario C: Everything is ready
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
                ready,
            }}
        >
            {children}
        </ContractsContext.Provider>
    );
};