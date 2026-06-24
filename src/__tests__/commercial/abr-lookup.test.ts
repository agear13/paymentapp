import { lookupAbn } from '@/lib/commercial/abr-lookup.server';

describe('abr-lookup', () => {
  it('rejects invalid ABN format via checksum', async () => {
    const result = await lookupAbn('12345678901', false);
    expect(result.isValid).toBe(false);
    expect(result.verificationSource).toBe('checksum');
  });

  it('accepts valid checksum when ABR_GUID is not configured', async () => {
    const prev = process.env.ABR_GUID;
    delete process.env.ABR_GUID;
    const result = await lookupAbn('51824753556', false);
    expect(result.verificationSource).toBe('checksum');
    expect(result.isValid).toBe(true);
    if (prev) process.env.ABR_GUID = prev;
  });

  it('handles not applicable without network', async () => {
    const result = await lookupAbn('', true);
    expect(result.verificationSource).toBe('not_applicable');
    expect(result.isValid).toBe(true);
  });
});
