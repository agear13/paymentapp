/**
 * TypeScript type declarations for window.ethereum
 * Used for detecting MetaMask and other EVM wallets
 */

interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    request?: (args: { method: string; params?: any[] }) => Promise<any>;
    on?: (event: string, callback: (...args: any[]) => void) => void;
    removeListener?: (event: string, callback: (...args: any[]) => void) => void;
  };
}







