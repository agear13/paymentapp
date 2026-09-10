import {
  applyProjectDetailsPatch,
  formatProjectValueLabel,
  projectValueIsSpecified,
} from '@/lib/projects/update-project-details';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

function deal(overrides: Partial<RecentDeal> = {}): RecentDeal {
  return {
    id: 'onb-deal-1',
    dealName: 'Weso Affiliate',
    partner: 'Weso',
    value: 0,
    introducer: '—',
    closer: '—',
    status: 'Pending',
    lastUpdated: '2026-09-01T00:00:00.000Z',
    paymentStatus: 'Not Paid',
    projectDescription: 'Initial description',
    projectValueCurrency: 'AUD',
    ...overrides,
  };
}

describe('project details after creation', () => {
  it('treats zero and missing values as not specified', () => {
    expect(projectValueIsSpecified(0)).toBe(false);
    expect(projectValueIsSpecified(undefined)).toBe(false);
    expect(projectValueIsSpecified(100000)).toBe(true);
    expect(formatProjectValueLabel(0)).toBe('Not specified');
  });

  it('creates with no project value and later accepts a value', () => {
    const created = applyProjectDetailsPatch(deal(), {
      dealName: 'Weso Affiliate',
      projectDescription: 'Affiliate program',
      partner: 'Weso',
      value: 0,
      projectValueCurrency: 'AUD',
    });
    expect(created.value).toBe(0);
    expect(projectValueIsSpecified(created.value)).toBe(false);

    const updated = applyProjectDetailsPatch(created, {
      dealName: created.dealName,
      projectDescription: created.projectDescription,
      partner: created.partner,
      value: 100000,
      projectValueCurrency: 'AUD',
    });
    expect(updated.value).toBe(100000);
    expect(formatProjectValueLabel(updated.value, 'AUD')).toMatch(/100,000/);
  });

  it('edits name, description, partner, existing value, and currency', () => {
    const updated = applyProjectDetailsPatch(
      deal({ value: 50000, projectValueCurrency: 'AUD' }),
      {
        dealName: 'Weso Community',
        projectDescription: 'Updated scope',
        partner: 'Weso Pty Ltd',
        value: 120000,
        projectValueCurrency: 'USD',
      }
    );
    expect(updated.dealName).toBe('Weso Community');
    expect(updated.projectDescription).toBe('Updated scope');
    expect(updated.partner).toBe('Weso Pty Ltd');
    expect(updated.value).toBe(120000);
    expect(updated.projectValueCurrency).toBe('USD');
  });

  it('requires a project name and does not invent a project value', () => {
    expect(() =>
      applyProjectDetailsPatch(deal(), {
        dealName: '   ',
        value: 0,
      })
    ).toThrow('Project name is required.');

    const blankValue = applyProjectDetailsPatch(deal({ value: 0 }), {
      dealName: 'Weso Affiliate',
      value: 0,
    });
    expect(blankValue.value).toBe(0);
  });
});
