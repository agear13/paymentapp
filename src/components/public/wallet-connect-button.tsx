'use client';

/**
 * Wallet Connect Button Component
 * Handles HashPack wallet connection/disconnection
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, LogOut, AlertCircle, Info, RotateCw } from 'lucide-react';
import {
  initHashConnect,
  openHashpackPairingModal,
  disconnectWallet,
  subscribeToWalletState,
  getWalletState,
} from '@/lib/hashconnectClient';
import { isChunkMismatchError, isUriMissingError } from '@/lib/walletErrors';
import { HederaWalletInfoModal } from './HederaWalletInfoModal';

interface WalletState {
  isConnected: boolean;
  accountId: string | null;
  network: string;
  isLoading: boolean;
  error: string | null;
}

export function WalletConnectButton() {
  const [walletState, setWalletState] = useState<WalletState>(getWalletState());
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showChunkMismatchError, setShowChunkMismatchError] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(false);

  useEffect(() => {
    // Initialize HashConnect on mount (non-blocking)
    initHashConnect().catch((error) => {
      console.error('[WalletConnect] Failed to initialize HashConnect:', error);
      // Error is already stored in wallet state
    });

    // Subscribe to wallet state changes
    const unsubscribe = subscribeToWalletState(setWalletState);

    // Detect MetaMask or other EVM wallets (non-fatal detection only)
    // This helps warn users who may have funds on other networks
    if (typeof window !== 'undefined' && window.ethereum) {
      setHasMetaMask(true);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    setShowChunkMismatchError(false);

    try {
      await openHashpackPairingModal();
      // Success - modal opened, user will complete pairing
      console.log('[WalletConnect] Pairing modal opened successfully');
    } catch (error) {
      console.error('[WalletConnect] Connection failed:', error);

      // Handle chunk mismatch errors
      if (isChunkMismatchError(error)) {
        setShowChunkMismatchError(true);
        setErrorMessage(
          'Deployment in progress. Please hard refresh (Ctrl+Shift+R or Cmd+Shift+R) to load the latest version.'
        );
        return;
      }

      // Handle URI missing errors
      if (isUriMissingError(error)) {
        setErrorMessage(
          'HashPack is still initializing. Please wait a moment and try again.'
        );
        return;
      }

      // Generic error
      const errorMsg = error instanceof Error ? error.message : 'Failed to connect wallet';
      setErrorMessage(errorMsg);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
      setErrorMessage(null);
    } catch (error) {
      console.error('[WalletConnect] Failed to disconnect:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to disconnect';
      setErrorMessage(errorMsg);
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  // Show connect screen when not connected
  if (!walletState.isConnected) {
    return (
      <>
        <div className="space-y-4">
          {/* MetaMask Detection Warning Banner */}
          {hasMetaMask && (
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-4">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-900">
                We detected a non-Hedera wallet (e.g. MetaMask). This payment requires 
                a Hedera wallet such as HashPack.
              </p>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Connect Your Wallet
              </CardTitle>
              <CardDescription>
                Connect your HashPack wallet to make a payment with HBAR, USDC, USDT, or AUDD
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleConnect}
                disabled={isConnecting || walletState.isLoading}
                className="w-full"
                size="lg"
              >
                {(isConnecting || walletState.isLoading) ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {walletState.isLoading ? 'Initializing...' : 'Connecting...'}
                  </>
                ) : (
                  <>
                    <Wallet className="mr-2 h-4 w-4" />
                    Connect HashPack
                  </>
                )}
              </Button>

              {/* Error Messages */}
              {(errorMessage || walletState.error) && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{errorMessage || walletState.error}</span>
                  </div>
                  
                  {/* Reload button for chunk mismatch errors */}
                  {showChunkMismatchError && (
                    <Button
                      onClick={handleReload}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <RotateCw className="mr-2 h-4 w-4" />
                      Reload Page
                    </Button>
                  )}
                </div>
              )}

              {/* Helper Note */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium">Note:</span> Only Hedera-native wallets and tokens are supported. 
                  If your funds are in another wallet (e.g. MetaMask), you&apos;ll need to create a Hedera 
                  wallet and transfer or exchange your tokens to the Hedera network before paying.
                </p>
                
                {/* Learn More Link */}
                <button
                  onClick={() => setShowInfoModal(true)}
                  className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 hover:underline transition-colors"
                >
                  <Info className="h-3 w-3" />
                  Why do I need a Hedera wallet?
                </button>
              </div>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              Don&apos;t have HashPack?{' '}
              <a
                href="https://www.hashpack.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Download here
              </a>
            </p>
          </div>
        </div>

        {/* Info Modal */}
        <HederaWalletInfoModal 
          isOpen={showInfoModal} 
          onClose={() => setShowInfoModal(false)} 
        />
      </>
    );
  }

  // Connected - show wallet info
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-green-600" />
              Wallet Connected
            </CardTitle>
            <Badge variant="outline" className="text-green-600 border-green-600">
              {walletState.network}
            </Badge>
          </div>
          <CardDescription className="font-mono text-xs">
            {walletState.accountId}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connected Message */}
          <div className="rounded-md bg-green-50 border border-green-200 p-3">
            <p className="text-sm text-green-900">
              Your wallet is connected. You can now proceed with your payment.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={walletState.isLoading}
              className="flex-1"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          </div>

          {/* Error Display */}
          {(errorMessage || walletState.error) && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <span>{errorMessage || walletState.error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Modal */}
      <HederaWalletInfoModal 
        isOpen={showInfoModal} 
        onClose={() => setShowInfoModal(false)} 
      />
    </>
  );
}
