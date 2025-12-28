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
import { Wallet, LogOut, RefreshCw, AlertCircle, Info } from 'lucide-react';
import type { WalletState } from '@/lib/hedera/types';
import {
  initializeHashConnect,
  connectWallet,
  disconnectWallet,
  refreshBalances,
  subscribeToWalletState,
  getWalletState,
} from '@/lib/hedera/wallet-service';
import { getTokenIcon } from '@/lib/hedera/token-service';
import { HederaWalletInfoModal } from './HederaWalletInfoModal';

export function WalletConnectButton() {
  const [walletState, setWalletState] = useState<WalletState>(getWalletState());
  const [isInitializing, setIsInitializing] = useState(true);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(false);

  useEffect(() => {
    // Initialize HashConnect on mount
    initializeHashConnect()
      .then(() => {
        setIsInitializing(false);
      })
      .catch((error) => {
        console.error('Failed to initialize HashConnect:', error);
        setIsInitializing(false);
      });

    // Subscribe to wallet state changes
    const unsubscribe = subscribeToWalletState(setWalletState);

    // Detect MetaMask or other EVM wallets
    // MetaMask and most EVM wallets inject window.ethereum
    // This helps warn users who may have funds on other networks
    if (typeof window !== 'undefined' && window.ethereum) {
      setHasMetaMask(true);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const handleConnect = async () => {
    try {
      await connectWallet();
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
    } catch (error) {
      console.error('Disconnection failed:', error);
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshBalances();
    } catch (error) {
      console.error('Failed to refresh balances:', error);
    }
  };

  if (isInitializing) {
    return (
      <Button disabled>
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        Initializing...
      </Button>
    );
  }

  // Not connected - show connect button
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
                disabled={walletState.isLoading}
                className="w-full"
                size="lg"
              >
                {walletState.isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="mr-2 h-4 w-4" />
                    Connect HashPack
                  </>
                )}
              </Button>

              {/* Helper Note */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium">Note:</span> Only Hedera-native wallets and tokens are supported. 
                  If your funds are in another wallet (e.g. MetaMask), you'll need to create a Hedera 
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

              {walletState.error && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <span>{walletState.error}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              Don't have HashPack?{' '}
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
        {/* Balances */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">
            Available Balances
          </div>
          <div className="space-y-2">
            {/* HBAR Balance */}
            <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getTokenIcon('HBAR')}</span>
                <span className="font-medium">HBAR</span>
              </div>
              <span className="font-mono text-sm">
                {parseFloat(walletState.balances.HBAR).toFixed(4)}
              </span>
            </div>

            {/* USDC Balance */}
            <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getTokenIcon('USDC')}</span>
                <span className="font-medium">USDC</span>
                <Badge variant="secondary" className="text-xs">
                  Stable
                </Badge>
              </div>
              <span className="font-mono text-sm">
                {parseFloat(walletState.balances.USDC).toFixed(2)}
              </span>
            </div>

            {/* USDT Balance */}
            <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getTokenIcon('USDT')}</span>
                <span className="font-medium">USDT</span>
                <Badge variant="secondary" className="text-xs">
                  Stable
                </Badge>
              </div>
              <span className="font-mono text-sm">
                {parseFloat(walletState.balances.USDT).toFixed(2)}
              </span>
            </div>

            {/* AUDD Balance */}
            <div className="flex items-center justify-between rounded-md bg-muted/50 p-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getTokenIcon('AUDD')}</span>
                <span className="font-medium">AUDD</span>
                <Badge variant="secondary" className="text-xs">
                  Stable
                </Badge>
              </div>
              <span className="font-mono text-sm">
                {parseFloat(walletState.balances.AUDD).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={walletState.isLoading}
            className="flex-1"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${walletState.isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
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

        {walletState.error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <span>{walletState.error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}






