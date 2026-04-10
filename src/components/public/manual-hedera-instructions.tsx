/**
 * Copy-paste Hedera wallet instructions (pilot) — no wallet connection required.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

export interface ManualHederaInstructionsProps {
  walletAddress: string;
  amount: string;
  currency: string;
  acceptedTokens: string[];
  paymentReference: string;
  networkLabel?: string;
}

function buildInstructionBlock(props: ManualHederaInstructionsProps): string {
  const network = props.networkLabel ?? 'Hedera';
  const tokens =
    props.acceptedTokens.length > 0 ? props.acceptedTokens.join(', ') : 'HBAR or supported stablecoins';
  return [
    `Network: ${network}`,
    `Send to wallet: ${props.walletAddress}`,
    `Amount: ${props.amount} ${props.currency}`,
    `Accepted assets (typical): ${tokens}`,
    props.paymentReference
      ? `Payment reference / memo: ${props.paymentReference}`
      : 'Include the payment reference shown on this page in your transfer memo if your wallet supports it.',
    '',
    'Do not send from an exchange unless you can set a memo/reference.',
  ].join('\n');
}

export function ManualHederaInstructions({
  walletAddress,
  amount,
  currency,
  acceptedTokens,
  paymentReference,
  networkLabel,
}: ManualHederaInstructionsProps) {
  const [copied, setCopied] = useState(false);
  const block = buildInstructionBlock({
    walletAddress,
    amount,
    currency,
    acceptedTokens,
    paymentReference,
    networkLabel,
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(block);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const tokenLine =
    acceptedTokens.length > 0 ? acceptedTokens.join(', ') : 'HBAR, USDC, USDT, or other tokens your merchant accepts';

  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Pay with crypto (manual transfer)</h3>
        <p className="text-sm text-slate-600 mt-1">
          Send from any wallet that supports {networkLabel ?? 'Hedera'}. You do not need to connect a wallet on this
          page.
        </p>
      </div>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="font-medium text-slate-700">Network</dt>
          <dd className="text-slate-900 font-mono">{networkLabel ?? 'Hedera'}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-700">Wallet address</dt>
          <dd className="text-slate-900 font-mono break-all">{walletAddress}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-700">Amount</dt>
          <dd className="text-slate-900 font-mono">
            {amount} {currency}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-700">Accepted assets</dt>
          <dd className="text-slate-800">{tokenLine}</dd>
        </div>
        {paymentReference ? (
          <div>
            <dt className="font-medium text-slate-700">Payment reference / memo</dt>
            <dd className="text-slate-900 font-mono break-all">{paymentReference}</dd>
          </div>
        ) : null}
      </dl>
      <pre className="text-xs bg-slate-50 border rounded-md p-3 whitespace-pre-wrap text-slate-800 max-h-48 overflow-y-auto">
        {block}
      </pre>
      <Button type="button" variant="outline" className="w-full gap-2" onClick={copy}>
        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy instructions'}
      </Button>
    </div>
  );
}
