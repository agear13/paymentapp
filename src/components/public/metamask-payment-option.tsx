/**
 * MetaMask Payment Option Component
 * Customer-facing EVM wallet checkout (displayed as "MetaMask").
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Wallet,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  connectMetaMask,
  formatWalletAddress,
  getConnectedChainId,
  getTokenBalance,
  getWalletNativeBalance,
  isMetaMaskAvailable,
  resolveNetworkFromChainId,
  sendErc20Payment,
  subscribeToAccountChanges,
  subscribeToChainChanges,
  switchToNetwork,
} from '@/lib/evm/metamask-client';
import { EVM_NETWORKS, type EvmNetworkId } from '@/lib/evm/networks';
import type { EvmSettlementToken } from '@/lib/evm/tokens';
import type { EvmTokenPaymentAmount } from '@/app/api/public/pay/[shortCode]/evm/payment-amounts/route';

interface MetaMaskPaymentOptionProps {
  isAvailable: boolean;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onPaymentSubmitted?: () => void;
  paymentLinkId: string;
  shortCode: string;
  amount: string;
  currency: string;
}

type PaymentStep =
  | 'select_method'
  | 'connect_wallet'
  | 'wrong_network'
  | 'select_token'
  | 'review_payment'
  | 'signing'
  | 'confirming'
  | 'paid'
  | 'failed';

export const MetaMaskPaymentOption: React.FC<MetaMaskPaymentOptionProps> = ({
  isAvailable,
  isSelected,
  isHovered,
  onSelect,
  onHoverStart,
  onHoverEnd,
  onPaymentSubmitted,
  paymentLinkId,
  shortCode,
  amount,
  currency,
}) => {
  const [step, setStep] = useState<PaymentStep>('select_method');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [networkId, setNetworkId] = useState<EvmNetworkId | null>(null);
  const [nativeBalance, setNativeBalance] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [merchantWallet, setMerchantWallet] = useState<string | null>(null);
  const [preferredNetworkId, setPreferredNetworkId] = useState<EvmNetworkId>('base');
  const [paymentAmounts, setPaymentAmounts] = useState<EvmTokenPaymentAmount[]>([]);
  const [selectedToken, setSelectedToken] = useState<EvmSettlementToken>('USDC');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  const selectedAmount = paymentAmounts.find((p) => p.tokenType === selectedToken);

  const refreshBalances = useCallback(async () => {
    if (!walletAddress || !networkId) return;
    try {
      const [native, token] = await Promise.all([
        getWalletNativeBalance(walletAddress as `0x${string}`, networkId),
        getTokenBalance(walletAddress as `0x${string}`, selectedToken, networkId),
      ]);
      setNativeBalance(native);
      setTokenBalance(token);
    } catch {
      // Non-fatal — balances are informational.
    }
  }, [walletAddress, networkId, selectedToken]);

  const loadConfig = useCallback(async () => {
    const response = await fetch(`/api/public/pay/${encodeURIComponent(shortCode)}/evm/config`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to load MetaMask configuration');
    }
    setMerchantWallet(data.data.merchantWalletAddress);
    setPreferredNetworkId(data.data.defaultNetworkId ?? 'base');
  }, [shortCode]);

  const loadPaymentAmounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/public/pay/${encodeURIComponent(shortCode)}/evm/payment-amounts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fiatAmount: parseFloat(amount),
            fiatCurrency: currency,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate token amounts');
      }
      setPaymentAmounts(data.data.paymentAmounts);
      const recommended = data.data.paymentAmounts.find(
        (p: EvmTokenPaymentAmount) => p.isRecommended
      );
      if (recommended) {
        setSelectedToken(recommended.tokenType);
      }
    } finally {
      setIsLoading(false);
    }
  }, [shortCode, amount, currency]);

  useEffect(() => {
    if (!isAvailable || !isSelected) return;
    loadConfig().catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load MetaMask config');
    });
    loadPaymentAmounts().catch(() => {
      // Amounts load on demand in review step too.
    });
  }, [isAvailable, isSelected, loadConfig, loadPaymentAmounts]);

  useEffect(() => {
    if (!isSelected) return;
    return subscribeToChainChanges((newChainId) => {
      setChainId(newChainId);
      const resolved = resolveNetworkFromChainId(newChainId);
      setNetworkId(resolved);
      if (resolved) {
        setStep('connect_wallet');
        setError(null);
      } else {
        setStep('wrong_network');
      }
    });
  }, [isSelected]);

  useEffect(() => {
    if (!isSelected) return;
    return subscribeToAccountChanges((accounts) => {
      if (accounts[0]) {
        setWalletAddress(accounts[0]);
      } else {
        setWalletAddress(null);
        setStep('connect_wallet');
      }
    });
  }, [isSelected]);

  useEffect(() => {
    if (walletAddress && networkId) {
      refreshBalances();
    }
  }, [walletAddress, networkId, selectedToken, refreshBalances]);

  const handleConnect = async () => {
    if (!isMetaMaskAvailable()) {
      toast.error('MetaMask is not installed');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const address = await connectMetaMask();
      setWalletAddress(address);

      const currentChainId = await getConnectedChainId();
      setChainId(currentChainId);
      const resolved = resolveNetworkFromChainId(currentChainId);

      if (!resolved) {
        setStep('wrong_network');
        return;
      }

      setNetworkId(resolved);
      setStep('select_token');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect MetaMask';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchNetwork = async (targetNetworkId: EvmNetworkId) => {
    setIsLoading(true);
    setError(null);
    try {
      await switchToNetwork(targetNetworkId);
      const currentChainId = await getConnectedChainId();
      setChainId(currentChainId);
      setNetworkId(targetNetworkId);
      setStep(walletAddress ? 'select_token' : 'connect_wallet');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to switch network';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePay = async () => {
    if (!merchantWallet || !networkId || !walletAddress || !selectedAmount) return;

    setIsLoading(true);
    setError(null);
    setStep('signing');

    try {
      const hash = await sendErc20Payment({
        token: selectedToken,
        networkId,
        recipient: merchantWallet as `0x${string}`,
        amount: selectedAmount.requiredAmount,
      });

      setTransactionHash(hash);
      setStep('confirming');
      onPaymentSubmitted?.();

      const response = await fetch(
        `/api/public/pay/${encodeURIComponent(shortCode)}/evm/pending`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionHash: hash,
            network: networkId,
            walletAddress,
            token: selectedToken,
            tokenAmount: selectedAmount.requiredAmount,
            exchangeRate: selectedAmount.exchangeRate,
            chainId,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to register pending payment');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      setError(message);
      setStep('failed');
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAvailable) return null;

  return (
    <div
      className={cn(
        'border-2 rounded-lg transition-all duration-200 cursor-pointer',
        isSelected
          ? 'border-orange-500 bg-orange-50/50 shadow-md'
          : isHovered
            ? 'border-orange-300 bg-orange-50/30'
            : 'border-slate-200 hover:border-orange-200'
      )}
      onClick={() => {
        if (!isSelected) onSelect();
      }}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      role="radio"
      aria-checked={isSelected}
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2 rounded-lg',
                isSelected ? 'bg-orange-100' : 'bg-slate-100'
              )}
            >
              <Wallet className={cn('h-5 w-5', isSelected ? 'text-orange-600' : 'text-slate-600')} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">MetaMask</h3>
              <p className="text-sm text-slate-500">Pay with USDC or USDT on Base, Ethereum, or Polygon</p>
            </div>
          </div>
          {isSelected && (
            <div className="p-1 rounded-full bg-orange-500">
              <Check className="h-4 w-4 text-white" />
            </div>
          )}
        </div>

        {isSelected && (
          <div className="mt-4 pt-4 border-t border-orange-200 space-y-4" onClick={(e) => e.stopPropagation()}>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === 'select_method' || step === 'connect_wallet' ? (
              <div className="space-y-3">
                {!walletAddress ? (
                  <Button onClick={handleConnect} disabled={isLoading} className="w-full">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Connect MetaMask wallet'
                    )}
                  </Button>
                ) : (
                  <div className="rounded-lg bg-white p-3 border text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Wallet</span>
                      <span className="font-mono">{formatWalletAddress(walletAddress)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Network</span>
                      <span>{networkId ? EVM_NETWORKS[networkId].name : 'Unknown'}</span>
                    </div>
                    {nativeBalance !== null && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Native balance</span>
                        <span>{parseFloat(nativeBalance).toFixed(4)}</span>
                      </div>
                    )}
                    {tokenBalance !== null && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">{selectedToken} balance</span>
                        <span>{parseFloat(tokenBalance).toFixed(4)}</span>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refreshBalances}
                      className="w-full mt-2"
                    >
                      <RefreshCw className="mr-2 h-3 w-3" />
                      Refresh balances
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            {step === 'wrong_network' && (
              <div className="space-y-3">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your wallet is on an unsupported network (chain ID {chainId}). Switch to Base,
                    Ethereum, or Polygon to continue.
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-1 gap-2">
                  {Object.values(EVM_NETWORKS).map((network) => (
                    <Button
                      key={network.id}
                      variant={network.id === preferredNetworkId ? 'default' : 'outline'}
                      onClick={() => handleSwitchNetwork(network.id)}
                      disabled={isLoading}
                    >
                      Switch to {network.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {(step === 'select_token' || step === 'review_payment') && walletAddress && networkId && (
              <div className="space-y-3">
                <div className="rounded-lg bg-white p-3 border text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Wallet</span>
                    <span className="font-mono">{formatWalletAddress(walletAddress)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Network</span>
                    <span>{EVM_NETWORKS[networkId].name}</span>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Select token</p>
                  <div className="grid grid-cols-2 gap-2">
                    {paymentAmounts.map((item) => (
                      <button
                        key={item.tokenType}
                        type="button"
                        onClick={() => setSelectedToken(item.tokenType)}
                        className={cn(
                          'p-3 rounded-lg border text-left transition-colors',
                          selectedToken === item.tokenType
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-slate-200 hover:border-orange-200'
                        )}
                      >
                        <p className="font-semibold">{item.tokenType}</p>
                        <p className="text-xs text-slate-500">{item.requiredAmount} {item.tokenType}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedAmount && merchantWallet && (
                  <div className="rounded-lg bg-slate-50 p-3 border text-sm space-y-2">
                    <p className="font-medium text-slate-900">Payment summary</p>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Amount</span>
                      <span>{selectedAmount.requiredAmount} {selectedToken}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Invoice</span>
                      <span>{amount} {currency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Recipient</span>
                      <span className="font-mono text-xs">{formatWalletAddress(merchantWallet)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Network</span>
                      <span>{EVM_NETWORKS[networkId].name}</span>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handlePay}
                  disabled={isLoading || !selectedAmount || !merchantWallet}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Pay ${selectedAmount?.requiredAmount ?? ''} ${selectedToken}`
                  )}
                </Button>
              </div>
            )}

            {step === 'signing' && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>Confirm the transaction in MetaMask...</AlertDescription>
              </Alert>
            )}

            {step === 'confirming' && transactionHash && (
              <div className="space-y-3">
                <Alert className="border-blue-200 bg-blue-50">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <AlertDescription>
                    <span className="font-medium">Waiting for confirmation...</span>
                    <br />
                    <span className="text-xs font-mono break-all">{transactionHash}</span>
                  </AlertDescription>
                </Alert>
                <p className="text-xs text-slate-500">
                  Status: Confirming — your payment will be marked Paid once the blockchain transaction
                  is confirmed.
                </p>
              </div>
            )}

            {step === 'failed' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Payment failed. {error ?? 'Please try again or choose another payment method.'}
                </AlertDescription>
              </Alert>
            )}

            {!isMetaMaskAvailable() && (
              <Button variant="outline" asChild className="w-full">
                <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">
                  Install MetaMask
                  <ExternalLink className="ml-2 h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
