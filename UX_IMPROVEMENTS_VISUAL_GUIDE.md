# Visual Guide - Crypto Payment UX Improvements

## Before vs After

### BEFORE
```
┌─────────────────────────────────────────┐
│  💳 Credit/Debit Card                   │
│  Pay with Visa, Mastercard, etc.       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  💰 Cryptocurrency                      │
│  Pay with HBAR, USDC, USDT, or AUDD    │
│                                         │
│  [Connect HashPack]                     │
└─────────────────────────────────────────┘
```

### AFTER (Without MetaMask)
```
┌─────────────────────────────────────────┐
│  💳 Credit/Debit Card                   │
│  Pay with Visa, Mastercard, etc.       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  💰 Cryptocurrency                      │
│  Pay with HBAR, USDC, USDT, or AUDD    │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ 👛 Connect Your Wallet            │ │
│  │ Connect your HashPack wallet...   │ │
│  │                                   │ │
│  │ [Connect HashPack]                │ │
│  │                                   │ │
│  │ Note: Only Hedera-native wallets  │ │ ← NEW
│  │ and tokens are supported. If your │ │
│  │ funds are in another wallet (e.g. │ │
│  │ MetaMask), you'll need to create  │ │
│  │ a Hedera wallet and transfer...   │ │
│  │                                   │ │
│  │ ℹ️ Why do I need a Hedera wallet? │ │ ← NEW (clickable)
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### AFTER (With MetaMask Detected)
```
┌─────────────────────────────────────────┐
│  💳 Credit/Debit Card                   │
│  Pay with Visa, Mastercard, etc.       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  💰 Cryptocurrency                      │
│  Pay with HBAR, USDC, USDT, or AUDD    │
│                                         │
│  ┌───────────────────────────────────┐ │ ← NEW WARNING
│  │ ⚠️  We detected a non-Hedera      │ │
│  │     wallet (e.g. MetaMask). This  │ │
│  │     payment requires a Hedera     │ │
│  │     wallet such as HashPack.      │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ 👛 Connect Your Wallet            │ │
│  │ Connect your HashPack wallet...   │ │
│  │                                   │ │
│  │ [Connect HashPack]                │ │
│  │                                   │ │
│  │ Note: Only Hedera-native wallets  │ │
│  │ and tokens are supported...       │ │
│  │                                   │ │
│  │ ℹ️ Why do I need a Hedera wallet? │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Modal Interaction

### When User Clicks "Why do I need a Hedera wallet?"

```
┌─────────────────────────────────────────┐
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                              ✕  │   │
│  │  Why a Hedera wallet is         │   │
│  │  required                       │   │
│  │                                 │   │
│  │  This payment uses the Hedera   │   │
│  │  network. Tokens like USDC,     │   │
│  │  USDT, and AUDD exist on        │   │
│  │  multiple blockchains. Only     │   │
│  │  tokens issued on Hedera can    │   │
│  │  be used here.                  │   │
│  │                                 │   │
│  │              [Got it]           │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

## Color Scheme

### MetaMask Warning Banner
- **Background:** Amber/Yellow (`bg-amber-50`)
- **Border:** Amber (`border-amber-200`)
- **Text:** Dark Amber (`text-amber-900`)
- **Icon:** Amber (`text-amber-600`)
- **Tone:** Informational, not alarming

### Helper Note
- **Text:** Muted/Secondary (`text-muted-foreground`)
- **Size:** Extra small (`text-xs`)
- **Weight:** Normal, with "Note:" in medium weight

### Learn More Link
- **Color:** Purple (`text-purple-600`)
- **Hover:** Darker purple with underline
- **Icon:** Info icon (ℹ️)
- **Size:** Extra small (`text-xs`)

### Modal
- **Background:** White with shadow
- **Backdrop:** Semi-transparent black (`bg-black/50`)
- **Button:** Purple (`bg-purple-600`)
- **Animation:** Fade-in with zoom

## Responsive Behavior

### Desktop (≥768px)
- Full-width card layout
- Modal centered on screen
- Comfortable padding and spacing

### Mobile (<768px)
- Stacked layout
- Modal takes most of screen width
- Touch-friendly button sizes
- Readable text sizes maintained

## Interaction States

### MetaMask Banner
| State | Condition |
|-------|-----------|
| **Visible** | `window.ethereum` exists AND HashConnect NOT connected |
| **Hidden** | No `window.ethereum` OR HashConnect IS connected |

### Learn More Modal
| Action | Result |
|--------|--------|
| Click link | Modal opens |
| Click X button | Modal closes |
| Click backdrop | Modal closes |
| Press ESC | Modal closes |
| Modal open | Body scroll disabled |

## Accessibility Features

### Keyboard Navigation
- ✅ Tab to "Learn more" link
- ✅ Enter/Space to open modal
- ✅ ESC to close modal
- ✅ Tab through modal elements
- ✅ Focus trapped in modal when open

### Screen Readers
- ✅ ARIA labels on all interactive elements
- ✅ `role="dialog"` on modal
- ✅ `aria-modal="true"` on modal
- ✅ `aria-labelledby` for modal title
- ✅ Descriptive button labels

### Visual Indicators
- ✅ Focus rings on interactive elements
- ✅ Hover states on buttons/links
- ✅ Color contrast meets WCAG AA
- ✅ Icons supplement text (not replace)

## Copy Reference

### Exact Copy (Do Not Modify)

**Helper Note:**
```
Note: Only Hedera-native wallets and tokens are supported. If your funds are in another wallet (e.g. MetaMask), you'll need to create a Hedera wallet and transfer or exchange your tokens to the Hedera network before paying.
```

**Learn More Link:**
```
Why do I need a Hedera wallet?
```

**MetaMask Warning:**
```
We detected a non-Hedera wallet (e.g. MetaMask). This payment requires a Hedera wallet such as HashPack.
```

**Modal Title:**
```
Why a Hedera wallet is required
```

**Modal Body:**
```
This payment uses the Hedera network. Tokens like USDC, USDT, and AUDD exist on multiple blockchains. Only tokens issued on Hedera can be used here.
```

## Implementation Notes

### MetaMask Detection Logic
```typescript
// Runs client-side only to avoid SSR issues
useEffect(() => {
  // MetaMask and most EVM wallets inject window.ethereum
  // This helps warn users who may have funds on other networks
  if (typeof window !== 'undefined' && window.ethereum) {
    setHasMetaMask(true);
  }
}, []);
```

### Conditional Rendering
```typescript
// Banner only shows when MetaMask detected AND not connected
{hasMetaMask && !walletState.isConnected && (
  <div className="bg-amber-50 border-amber-200...">
    Warning message
  </div>
)}
```

### Modal State Management
```typescript
const [showInfoModal, setShowInfoModal] = useState(false);

// Open modal
<button onClick={() => setShowInfoModal(true)}>
  Why do I need a Hedera wallet?
</button>

// Close modal
<HederaWalletInfoModal 
  isOpen={showInfoModal} 
  onClose={() => setShowInfoModal(false)} 
/>
```







