/**
 * Shared invoice presentation data.
 * Extracted from the Invoice Workspace so the Invoice Detail page can reuse
 * the exact same records, statuses and payment/Xero/crypto capabilities.
 * No new backend functionality — presentation layer only.
 */

export type Status = "Draft" | "Sent" | "Viewed" | "Paid" | "Overdue" | "Cancelled";
export type Method = "Stripe" | "Pinch" | "Crypto" | "Bank Transfer" | "Wallet";
export type Currency = "AUD" | "USD" | "USDC" | "HBAR";
export type Xero = "Synced" | "Pending" | "Not synced" | "Error";
export type PayStatus = "Unpaid" | "Part paid" | "Confirming" | "Settled";

export interface Invoice {
  id: string;
  number: string;
  customer: string;
  description: string;
  amount: number;
  display: string;
  currency: Currency;
  method: Method;
  created: string;
  due: string;
  status: Status;
  pay: PayStatus;
  xero: Xero;
  outstanding?: string;
  events: { label: string; detail: string; time: string }[];
  chain?: { network: string; hash: string; confirmations: string; progress?: number; wallet?: string; token?: string; gas?: string };
  fx?: { rate: string; captured: string; settles: string };
  settlement?: string;
  refs?: { label: string; value: string }[];
  attempts?: { label: string; detail: string; state: string }[];
  attachments?: { name: string; meta: string }[];
  ai?: { text: string; cta: string; tone?: "warn" }[];
}

export const INVOICES: Invoice[] = [
  {
    id: "1",
    number: "INV-1041",
    customer: "Kestrel Freight",
    description: "Q3 freight coordination retainer",
    amount: 5400,
    display: "A$5,400.00",
    currency: "AUD",
    method: "Bank Transfer",
    created: "2 Jul",
    due: "Overdue 3 days",
    status: "Overdue",
    pay: "Unpaid",
    xero: "Synced",
    outstanding: "A$5,400.00",
    events: [
      { label: "Invoice created", detail: "Drafted from agreement AG-221", time: "2 Jul · 09:14" },
      { label: "Invoice sent", detail: "accounts@kestrelfreight.com.au", time: "2 Jul · 09:20" },
      { label: "Invoice viewed", detail: "Opened twice", time: "5 Jul · 16:02" },
      { label: "Reminder sent", detail: "Automatic · 3 days before due", time: "12 Jul · 08:00" },
      { label: "Marked overdue", detail: "No payment received", time: "16 Jul · 00:05" },
    ],
    settlement: "Awaiting funds · operating account ••4821",
    refs: [
      { label: "Xero invoice", value: "INV-1041" },
      { label: "Ledger account", value: "200 · Sales" },
      { label: "Tax treatment", value: "GST on income" },
      { label: "Journal reference", value: "JRN-40118" },
      { label: "Last sync", value: "2 Jul · 09:21" },
    ],
    attempts: [{ label: "Bank transfer", detail: "No inbound payment matched", state: "Pending" }],
    attachments: [{ name: "INV-1041.pdf", meta: "Invoice PDF · 84 KB" }],
    ai: [
      { text: "This invoice is 3 days overdue and no reminder has been sent since 12 Jul.", cta: "Send reminder", tone: "warn" },
      { text: "Kestrel Freight has paid every prior invoice within 9 days of the due date.", cta: "Schedule follow-up" },
    ],
  },
  {
    id: "2",
    number: "INV-1044",
    customer: "Northbridge Logistics",
    description: "Monthly platform + coordination fee",
    amount: 4800,
    display: "A$4,800.00",
    currency: "AUD",
    method: "Pinch",
    created: "1 Aug",
    due: "In 4 days",
    status: "Sent",
    pay: "Unpaid",
    xero: "Synced",
    outstanding: "A$4,800.00",
    events: [
      { label: "Invoice created", detail: "Recurring candidate detected", time: "1 Aug · 06:00" },
      { label: "Invoice sent", detail: "ap@northbridge.com.au", time: "1 Aug · 06:01" },
      { label: "Direct debit scheduled", detail: "Pinch · debits on due date", time: "1 Aug · 06:02" },
    ],
    settlement: "Pinch direct debit · T+1 to operating account",
    refs: [
      { label: "Xero invoice", value: "INV-1044" },
      { label: "Pinch payer", value: "PY-88213" },
      { label: "Last sync", value: "1 Aug · 06:03" },
    ],
    attempts: [{ label: "Pinch direct debit", detail: "Scheduled for due date", state: "Scheduled" }],
    attachments: [{ name: "INV-1044.pdf", meta: "Invoice PDF · 79 KB" }],
    ai: [
      { text: "This customer has been invoiced the same amount for 6 months running.", cta: "Create recurring invoice" },
      { text: "Direct debit is scheduled — no manual collection required.", cta: "Dismiss" },
    ],
  },
  {
    id: "3",
    number: "INV-1045",
    customer: "Halcyon Studio",
    description: "Design system licence · August",
    amount: 2400,
    display: "USDC 2,400.00",
    currency: "USDC",
    method: "Crypto",
    created: "1 Aug",
    due: "In 6 days",
    status: "Viewed",
    pay: "Confirming",
    xero: "Pending",
    outstanding: "USDC 0.00",
    events: [
      { label: "Invoice created", detail: "USDC default applied", time: "1 Aug · 10:12" },
      { label: "Invoice viewed", detail: "Payment link opened", time: "1 Aug · 11:40" },
      { label: "Payment initiated", detail: "Wallet 0x4f2b…c118", time: "2 Aug · 02:29" },
      { label: "Payment detected", detail: "USDC 2,400 · Base", time: "2 Aug · 02:31" },
      { label: "Confirming", detail: "9 of 12 confirmations", time: "2 Aug · 02:33" },
    ],
    chain: {
      network: "Base",
      hash: "0x7a1c…9fe2",
      confirmations: "9 / 12 confirmations",
      progress: 75,
      wallet: "0x4f2b…c118",
      token: "USDC",
      gas: "0.00021 ETH",
    },
    fx: { rate: "1 USDC = A$1.52", captured: "2 Aug · 02:31", settles: "A$3,648.00" },
    settlement: "Converts to AUD on confirmation",
    refs: [
      { label: "Xero invoice", value: "Queued for sync" },
      { label: "Last sync", value: "Not yet synced" },
    ],
    attempts: [{ label: "USDC transfer", detail: "USDC 2,400 · Base", state: "Confirming" }],
    attachments: [{ name: "INV-1045.pdf", meta: "Invoice PDF · 81 KB" }],
    ai: [
      { text: "Payment is confirming on Base — 9 of 12 confirmations, roughly 2 minutes remaining.", cta: "Review crypto confirmation" },
      { text: "Halcyon Studio prefers USDC and usually pays within 24 hours of viewing.", cta: "Dismiss" },
      { text: "Xero sync is queued and will run once the transfer settles.", cta: "Push to Xero" },
    ],
  },
  {
    id: "4",
    number: "INV-1043",
    customer: "Arbor & Co",
    description: "Implementation sprint 2",
    amount: 6200,
    display: "A$6,200.00",
    currency: "AUD",
    method: "Stripe",
    created: "18 Jul",
    due: "Paid today",
    status: "Paid",
    pay: "Settled",
    xero: "Synced",
    outstanding: "A$0.00",
    events: [
      { label: "Invoice created", detail: "From workflow WF-Recon", time: "18 Jul · 14:02" },
      { label: "Invoice sent", detail: "finance@arborco.com", time: "18 Jul · 14:03" },
      { label: "Payment received", detail: "A$6,200 · Visa ••4242", time: "2 Aug · 07:12" },
      { label: "Reconciled to Xero", detail: "Matched to bank line", time: "2 Aug · 07:14" },
    ],
    settlement: "Settled A$6,141.30 net of fees · 2 Aug",
    refs: [
      { label: "Xero invoice", value: "INV-1043" },
      { label: "Stripe charge", value: "ch_3PqL…8Z" },
      { label: "Journal reference", value: "JRN-40233" },
      { label: "Last sync", value: "2 Aug · 07:14" },
    ],
    attempts: [{ label: "Stripe card payment", detail: "Visa ••4242", state: "Succeeded" }],
    attachments: [
      { name: "INV-1043.pdf", meta: "Invoice PDF · 86 KB" },
      { name: "receipt-1043.pdf", meta: "Generated receipt · 41 KB" },
    ],
    ai: [
      { text: "Paid and reconciled — nothing is waiting on you for this invoice.", cta: "Dismiss" },
      { text: "Arbor & Co has paid 4 sprints on identical terms.", cta: "Create recurring invoice" },
    ],
  },
  {
    id: "5",
    number: "INV-1046",
    customer: "Sable Interiors",
    description: "Fit-out consultation",
    amount: 1150,
    display: "A$1,150.00",
    currency: "AUD",
    method: "Stripe",
    created: "Today",
    due: "Not sent",
    status: "Draft",
    pay: "Unpaid",
    xero: "Not synced",
    outstanding: "A$1,150.00",
    events: [{ label: "Draft created", detail: "Awaiting review", time: "Today · 06:40" }],
    refs: [
      { label: "Xero invoice", value: "Not created" },
      { label: "Last sync", value: "Never" },
    ],
    attachments: [{ name: "INV-1046-draft.pdf", meta: "Draft PDF · 62 KB" }],
    ai: [
      { text: "This draft has been sitting unsent since this morning.", cta: "Send invoice" },
      { text: "Amount matches the two previous Sable Interiors consultations.", cta: "Dismiss" },
    ],
  },
  {
    id: "6",
    number: "INV-1039",
    customer: "Meridian Group",
    description: "Advisory retainer · June",
    amount: 3300,
    display: "US$3,300.00",
    currency: "USD",
    method: "Wallet",
    created: "12 Jun",
    due: "Overdue 21 days",
    status: "Overdue",
    pay: "Part paid",
    xero: "Error",
    outstanding: "US$1,800.00",
    events: [
      { label: "Invoice sent", detail: "ops@meridian.co", time: "12 Jun · 08:00" },
      { label: "Part payment", detail: "US$1,500 received", time: "28 Jun · 19:22" },
      { label: "Xero sync failed", detail: "Contact not found in ledger", time: "29 Jun · 03:00" },
    ],
    fx: { rate: "1 USD = A$1.51", captured: "28 Jun", settles: "A$4,983.00" },
    settlement: "Partially settled · US$1,800 outstanding",
    refs: [
      { label: "Xero invoice", value: "Sync error" },
      { label: "Last sync", value: "29 Jun · 03:00" },
    ],
    attempts: [
      { label: "Wallet payment", detail: "US$1,500 received", state: "Succeeded" },
      { label: "Balance", detail: "US$1,800 outstanding", state: "Pending" },
    ],
    attachments: [{ name: "INV-1039.pdf", meta: "Invoice PDF · 88 KB" }],
    ai: [
      { text: "Xero sync failed because the customer contact is missing in the ledger.", cta: "Retry sync", tone: "warn" },
      { text: "US$1,800 is still outstanding, 21 days past due.", cta: "Send reminder", tone: "warn" },
    ],
  },
  {
    id: "7",
    number: "INV-1038",
    customer: "Cobalt Renewables",
    description: "Energy audit milestone 1",
    amount: 9800,
    display: "A$9,800.00",
    currency: "AUD",
    method: "Bank Transfer",
    created: "5 Jun",
    due: "Cancelled",
    status: "Cancelled",
    pay: "Unpaid",
    xero: "Synced",
    outstanding: "A$0.00",
    events: [
      { label: "Invoice sent", detail: "finance@cobalt.energy", time: "5 Jun · 11:00" },
      { label: "Cancelled", detail: "Scope superseded by AG-244", time: "9 Jun · 15:31" },
    ],
    refs: [
      { label: "Xero invoice", value: "Voided" },
      { label: "Last sync", value: "9 Jun · 15:32" },
    ],
    attachments: [{ name: "INV-1038.pdf", meta: "Invoice PDF · 90 KB" }],
    ai: [{ text: "Cancelled and voided in Xero — no action required.", cta: "Dismiss" }],
  },
  {
    id: "8",
    number: "INV-1042",
    customer: "Longview Partners",
    description: "Quarterly data services",
    amount: 7250,
    display: "HBAR 41,200",
    currency: "HBAR",
    method: "Crypto",
    created: "20 Jul",
    due: "In 2 days",
    status: "Viewed",
    pay: "Unpaid",
    xero: "Pending",
    outstanding: "HBAR 41,200",
    events: [
      { label: "Invoice sent", detail: "Payment link · HBAR", time: "20 Jul · 09:00" },
      { label: "Invoice viewed", detail: "Opened 4 times, no payment", time: "31 Jul · 21:10" },
    ],
    chain: {
      network: "Hedera",
      hash: "0.0.4488…",
      confirmations: "Awaiting transfer",
      progress: 0,
      token: "HBAR",
    },
    fx: { rate: "1 HBAR = A$0.176", captured: "20 Jul", settles: "A$7,251.20" },
    refs: [
      { label: "Xero invoice", value: "Queued for sync" },
      { label: "Last sync", value: "Not yet synced" },
    ],
    attempts: [{ label: "HBAR transfer", detail: "No transfer received", state: "Pending" }],
    attachments: [{ name: "INV-1042.pdf", meta: "Invoice PDF · 83 KB" }],
    ai: [
      { text: "Viewed 4 times without payment — usually a sign of a pricing question.", cta: "Send reminder" },
      { text: "No HBAR transfer has landed yet on Hedera.", cta: "Review crypto confirmation" },
    ],
  },
];

export const STATUS_CLS: Record<Status, string> = {
  Draft: "bg-secondary text-ink-soft",
  Sent: "bg-primary/10 text-primary",
  Viewed: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  Paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Overdue: "bg-destructive/10 text-destructive",
  Cancelled: "bg-secondary text-ink-soft line-through",
};

export const XERO_DOT: Record<Xero, string> = {
  Synced: "bg-emerald-500",
  Pending: "bg-amber-500",
  "Not synced": "bg-muted-foreground/50",
  Error: "bg-destructive",
};

export const STATUSES: Status[] = ["Draft", "Sent", "Viewed", "Paid", "Overdue", "Cancelled"];
export const METHODS: Method[] = ["Stripe", "Pinch", "Crypto", "Bank Transfer", "Wallet"];
export const CURRENCIES: Currency[] = ["AUD", "USD", "USDC", "HBAR"];
export const XEROS: Xero[] = ["Synced", "Pending", "Not synced", "Error"];

export function findInvoice(idOrNumber: string): Invoice | undefined {
  const key = decodeURIComponent(idOrNumber).toLowerCase();
  return INVOICES.find((i) => i.id === key || i.number.toLowerCase() === key);
}

/** Human summary of where the invoice stands right now. */
export function heroState(invoice: Invoice): { headline: string; tone: "good" | "warn" | "bad" | "info" } {
  if (invoice.status === "Paid") return { headline: "Paid", tone: "good" };
  if (invoice.status === "Cancelled") return { headline: "Cancelled", tone: "info" };
  if (invoice.pay === "Confirming") return { headline: "Crypto confirming", tone: "info" };
  if (invoice.status === "Overdue") return { headline: "Overdue", tone: "bad" };
  if (invoice.status === "Viewed") return { headline: "Viewed, awaiting payment", tone: "warn" };
  if (invoice.status === "Draft") return { headline: "Draft, not sent", tone: "info" };
  return { headline: "Awaiting payment", tone: "warn" };
}
