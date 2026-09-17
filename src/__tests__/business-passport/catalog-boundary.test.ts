import fs from 'fs';
import path from 'path';
import {
  getOfferingPassportMeta,
  getOnboardingRequirements,
  offeringHasPassportCatalog,
} from '@/lib/business-passport/requirement-catalog';
import { selectPassportOffering } from '@/lib/business-passport/select-offering';

const PASSPORT_DIR = [
  path.join(process.cwd(), 'lib/business-passport'),
  path.join(process.cwd(), 'src/lib/business-passport'),
].find((dir) => fs.existsSync(dir));

if (!PASSPORT_DIR) {
  throw new Error('Could not find src/lib/business-passport');
}

function readPassportSources(): string {
  return fs
    .readdirSync(PASSPORT_DIR)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => fs.readFileSync(path.join(PASSPORT_DIR, file), 'utf8'))
    .join('\n');
}

describe('business passport catalog and boundaries', () => {
  it('catalogues Airwallex offerings with seven information requirements', () => {
    expect(offeringHasPassportCatalog('airwallex-international')).toBe(true);
    expect(offeringHasPassportCatalog('airwallex-local')).toBe(true);
    expect(offeringHasPassportCatalog('wise-international')).toBe(false);

    const requirements = getOnboardingRequirements('airwallex-international');
    expect(requirements?.map((item) => item.id)).toEqual([
      'business_registration',
      'business_identity',
      'business_address',
      'business_activity',
      'settlement_information',
      'director_verification',
      'proof_of_business_address',
    ]);
    expect(getOfferingPassportMeta('airwallex-international')?.providerName).toBe('Airwallex');
  });

  it('selects a catalogued Airwallex alternative without ranking', () => {
    expect(
      selectPassportOffering({
        scenarioOffering: {
          offeringId: 'airwallex-international',
          providerId: 'airwallex',
          providerName: 'Airwallex',
        },
        alternatives: [
          { offeringId: 'wise-international', providerId: 'wise', providerName: 'Wise' },
        ],
      })?.offeringId
    ).toBe('airwallex-international');

    expect(
      selectPassportOffering({
        alternatives: [
          { offeringId: 'wise-international', providerId: 'wise', providerName: 'Wise' },
          { offeringId: 'airwallex-international', providerId: 'airwallex', providerName: 'Airwallex' },
        ],
      })?.offeringId
    ).toBe('airwallex-international');
  });

  it('does not import ranking, observation persistence, Canton, or the 5/7 fixture', () => {
    const sources = readPassportSources();
    expect(sources).not.toContain('observation-store.server');
    expect(sources).not.toContain('rankLandingRoutes');
    expect(sources).not.toContain('compareLandingRoutes');
    expect(sources).not.toContain('commercial-network');
    expect(sources).not.toContain('canton');
    expect(sources).not.toContain('five-of-seven.fixture');
    expect(sources).not.toContain('persistRouteFxObservation');
  });

  it('never assigns fabricated registration, address, or director fields in the production collector', () => {
    const collector = fs.readFileSync(path.join(PASSPORT_DIR, 'evidence-sources.server.ts'), 'utf8');
    expect(collector).not.toContain('registrationNumber:');
    expect(collector).not.toContain('businessAddress:');
    expect(collector).not.toContain('directorVerificationAt:');
    expect(collector).not.toContain('proofOfBusinessAddress:');
    expect(collector).not.toContain('51 824 753 556');
    expect(collector).not.toContain('1 Example Street');
  });
});
