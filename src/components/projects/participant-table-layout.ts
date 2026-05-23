/** Shared participant table column sizing — keep colgroup and cells aligned. */
export const PARTICIPANT_TABLE_MIN_WIDTH = 1200;

export const PARTICIPANT_TABLE_COLUMNS = [
  { key: 'participant', width: '22%', minWidth: 200 },
  { key: 'role', width: '10%', minWidth: 96 },
  { key: 'agreement', width: '18%', minWidth: 180 },
  { key: 'attribution', width: '16%', minWidth: 160 },
  { key: 'payout', width: '16%', minWidth: 160 },
  { key: 'earnings', width: '14%', minWidth: 140 },
  { key: 'actions', width: '4%', minWidth: 52 },
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
  const base = 'align-top py-5 first:pl-4 last:pr-4';
  switch (key) {
    case 'participant':
      return `${base} whitespace-normal min-w-[200px]`;
    case 'role':
      return `${base} whitespace-nowrap text-sm`;
    case 'agreement':
    case 'attribution':
    case 'payout':
      return `${base} whitespace-normal`;
    case 'earnings':
      return `${base} whitespace-normal min-w-[140px]`;
    case 'actions':
      return `${base} w-[52px] min-w-[52px] max-w-[52px] p-2 align-middle`;
    default:
      return base;
  }
}
