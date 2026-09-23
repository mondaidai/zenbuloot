// components/BalanceProviderWrapper.jsx
import { useWallet } from "@/context/WalletContext";
import { ContractBalanceProvider } from "@/context/BalanceContext";

export function BalanceProviderWrapper({ children }) {
  const { address, connected } = useWallet();
  
  return (
    <ContractBalanceProvider address={address} connected={connected}>
      {children}
    </ContractBalanceProvider>
  );
}