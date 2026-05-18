import { redirect } from 'next/navigation';
import { REPORTS_LEDGER_HREF } from '@/lib/navigation/operator-nav';

/** Legacy ledger URL — ledger lives under Reports for operator IA. */
export default function LedgerRedirectPage() {
  redirect(REPORTS_LEDGER_HREF);
}
