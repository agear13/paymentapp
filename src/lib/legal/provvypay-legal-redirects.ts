import {
  PROVVYPAY_PRIVACY_PATH,
  PROVVYPAY_TERMS_PATH,
} from './provvypay-legal-paths';

export const PROVVYPAY_LEGAL_REDIRECTS = [
  {
    source: '/legal/terms',
    destination: PROVVYPAY_TERMS_PATH,
    permanent: true,
  },
  {
    source: '/legal/privacy',
    destination: PROVVYPAY_PRIVACY_PATH,
    permanent: true,
  },
] as const;
