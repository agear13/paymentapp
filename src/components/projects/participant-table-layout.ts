/** Shared participant table column sizing — keep colgroup and cells aligned. */
export const PARTICIPANT_TABLE_MIN_WIDTH = 1320;

export const PARTICIPANT_TABLE_COLUMNS = [
  { key: 'participant', width: '20%', minWidth: 180 },
  { key: 'role', width: '9%', minWidth: 88 },
  { key: 'agreement', width: '11%', minWidth: 100 },
  { key: 'attribution', width: '14%', minWidth: 140 },
  { key: 'payout', width: '14%', minWidth: 140 },
  { key: 'earnings', width: '12%', minWidth: 120 },
  { key: 'nextAction', width: '16%', minWidth: 160 },
  { key: 'actions', width: '8%', minWidth: 88 },
] as const;

export function participantTableHeadClass(index: number): string {
  const col = PARTICIPANT_TABLE_COLUMNS[index];
  if (!col) return '';
  if (col.key === 'actions') return 'text-right';
  return '';
}

export function participantTableCellClass(
  key: (typeof PARTICIPANT_TABLE_COLUMNS)[number]['key']
): string {
  const base = 'align-top py-4 first:pl-4 last:pr-4';
  switch (key) {
    case 'participant':
      return `${base} whitespace-normal min-w-[180px]`;
    case 'role':
      return `${base} whitespace-nowrap text-sm`;
    case 'agreement':
    case 'payout':
      return `${base} whitespace-normal text-sm`;
    case 'attribution':
      return `${base} whitespace-normal`;
    case 'earnings':
      return `${base} whitespace-normal min-w-[120px]`;
    case 'nextAction':
      return `${base} whitespace-normal min-w-[160px]`;
    case 'actions':
      return `${base} min-w-[88px] p-2 align-middle whitespace-nowrap text-right`;
    default:
      return base;
  }
}
