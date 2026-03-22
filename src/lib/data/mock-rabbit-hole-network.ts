/**
 * Mock Rabbit Hole identity graph for Deal Network demo only.
 * Companies, contacts, specialties, and recorded introducer attribution.
 */

export interface RhCompany {
  id: string;
  name: string;
}

export interface RhContact {
  id: string;
  companyId: string;
  name: string;
  title: string;
  /** Area of focus (e.g. BD, compliance) */
  specialty: string;
  /** Who the graph records as having brought this contact into the network */
  introducedBy: string;
}

export const rhCompanies: RhCompany[] = [
  { id: 'co-certik', name: 'CertiK' },
  { id: 'co-chainalysis', name: 'Chainalysis' },
  { id: 'co-wintermute', name: 'Wintermute' },
  { id: 'co-dverse', name: 'Dverse' },
  { id: 'co-growth', name: 'Growth Agency' },
];

export const rhContacts: RhContact[] = [
  {
    id: 'ct-bob-certik',
    companyId: 'co-certik',
    name: 'Bob',
    title: 'BD Lead',
    specialty: 'Security audits',
    introducedBy: 'Alice',
  },
  {
    id: 'ct-ming-certik',
    companyId: 'co-certik',
    name: 'Ming',
    title: 'Solutions Engineer',
    specialty: 'Smart contract review',
    introducedBy: 'Charlie',
  },
  {
    id: 'ct-sarah-chain',
    companyId: 'co-chainalysis',
    name: 'Sarah',
    title: 'Partnerships',
    specialty: 'Compliance programs',
    introducedBy: 'Alice',
  },
  {
    id: 'ct-james-chain',
    companyId: 'co-chainalysis',
    name: 'James',
    title: 'Account Director',
    specialty: 'Enterprise sales',
    introducedBy: 'Ben',
  },
  {
    id: 'ct-alex-wm',
    companyId: 'co-wintermute',
    name: 'Alex',
    title: 'Liquidity Lead',
    specialty: 'Market making',
    introducedBy: 'Charlie',
  },
  {
    id: 'ct-ria-wm',
    companyId: 'co-wintermute',
    name: 'Ria',
    title: 'Biz Dev',
    specialty: 'OTC & listings',
    introducedBy: 'Alice',
  },
  {
    id: 'ct-taylor-dv',
    companyId: 'co-dverse',
    name: 'Taylor',
    title: 'Ecosystem',
    specialty: 'Token listings',
    introducedBy: 'Ben',
  },
  {
    id: 'ct-jordan-growth',
    companyId: 'co-growth',
    name: 'Jordan',
    title: 'Head of Growth',
    specialty: 'Retainers & GTM',
    introducedBy: 'Charlie',
  },
];

export function getCompanyById(id: string): RhCompany | undefined {
  return rhCompanies.find((c) => c.id === id);
}

export function getContactsForCompany(companyId: string): RhContact[] {
  return rhContacts.filter((c) => c.companyId === companyId);
}

export function getContactById(id: string): RhContact | undefined {
  return rhContacts.find((c) => c.id === id);
}

/** e.g. Bob — BD Lead — CertiK */
export function formatRhContactLine(contact: RhContact, companyName: string): string {
  return `${contact.name} — ${contact.title} — ${companyName}`;
}
