export type AttachedWorkspaceInvoice = {
  id: string;
  invoiceReference: string | null;
  shortCode: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  href: string;
};
