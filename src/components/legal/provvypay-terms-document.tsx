import LegalDocument from '@/components/legal/LegalDocument';

const sections = [
  { id: 'introduction', title: 'Introduction' },
  { id: 'about-provvypay', title: 'About Provvypay' },
  { id: 'eligibility', title: 'Eligibility' },
  { id: 'user-content', title: 'User Content' },
  { id: 'ai-agreement-intelligence', title: 'AI and Agreement Intelligence' },
  { id: 'third-party-services', title: 'Third-Party Services' },
  { id: 'fees', title: 'Fees' },
  { id: 'acceptable-use', title: 'Acceptable Use' },
  { id: 'intellectual-property', title: 'Intellectual Property' },
  { id: 'availability', title: 'Availability' },
  { id: 'disclaimers', title: 'Disclaimers' },
  { id: 'limitation-of-liability', title: 'Limitation of Liability' },
  { id: 'indemnity', title: 'Indemnity' },
  { id: 'termination', title: 'Termination' },
  { id: 'governing-law', title: 'Governing Law' },
  { id: 'contact', title: 'Contact' },
];

export function ProvvypayTermsDocument() {
  return (
    <LegalDocument
      title="Provvypay Terms of Service"
      effectiveDate="8 June 2026"
      lastUpdated="8 June 2026"
      version="2.0.0"
      sections={sections}
    >
      <section id="introduction" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Introduction</h2>
        <p className="mb-4">Welcome to Provvypay.</p>
        <p className="mb-4">
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Provvypay
          platform, website, software, APIs and related services (collectively, the
          &quot;Services&quot;).
        </p>
        <p className="mb-4">
          By creating an account, accessing or using the Services, you agree to be bound by these
          Terms.
        </p>
        <p>If you do not agree to these Terms, you must not use the Services.</p>
      </section>

      <section id="about-provvypay" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">2. About Provvypay</h2>
        <p className="mb-4">Provvypay provides software that assists businesses in:</p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>capturing agreements from conversations and documents;</li>
          <li>structuring obligations and commercial arrangements;</li>
          <li>coordinating settlement workflows;</li>
          <li>generating reports and operational insights;</li>
          <li>integrating with third-party payment and accounting providers.</li>
        </ul>
        <p className="mb-4">Provvypay is a software platform only. Provvypay does not:</p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>hold customer funds;</li>
          <li>provide banking services;</li>
          <li>provide remittance services;</li>
          <li>provide financial product advice;</li>
          <li>provide investment services;</li>
          <li>operate payment accounts;</li>
          <li>act as a trustee or custodian of funds.</li>
        </ul>
        <p>All payments are processed by independent third-party providers selected by users.</p>
      </section>

      <section id="eligibility" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Eligibility</h2>
        <p className="mb-4">You must:</p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>be at least 18 years old;</li>
          <li>have authority to act on behalf of your organisation;</li>
          <li>provide accurate registration information.</li>
        </ul>
        <p>You are responsible for maintaining the security of your account credentials.</p>
      </section>

      <section id="user-content" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">4. User Content</h2>
        <p className="mb-4">
          You retain ownership of all content uploaded to the Services, including:
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>conversations;</li>
          <li>documents;</li>
          <li>agreements;</li>
          <li>payment information;</li>
          <li>reports;</li>
          <li>business records.</li>
        </ul>
        <p className="mb-4">
          You grant Provvypay a non-exclusive licence to use, process, store and display such
          content solely for the purpose of operating and improving the Services.
        </p>
        <p className="mb-4">You warrant that:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>you have the right to upload the content;</li>
          <li>your use of the Services does not violate any law or third-party rights.</li>
        </ul>
      </section>

      <section id="ai-agreement-intelligence" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          5. AI and Agreement Intelligence
        </h2>
        <p className="mb-4">
          Provvypay may use artificial intelligence and automated systems to:
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>analyse conversations;</li>
          <li>extract obligations;</li>
          <li>identify participants;</li>
          <li>generate suggested settlement workflows;</li>
          <li>create operational summaries.</li>
        </ul>
        <p className="mb-4">AI-generated outputs are provided for informational purposes only.</p>
        <p className="mb-4">Users remain solely responsible for:</p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>reviewing outputs;</li>
          <li>validating extracted information;</li>
          <li>confirming commercial arrangements;</li>
          <li>ensuring legal accuracy.</li>
        </ul>
        <p>
          Provvypay does not guarantee that AI-generated outputs are complete, accurate or legally
          enforceable.
        </p>
      </section>

      <section id="third-party-services" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Third-Party Services</h2>
        <p className="mb-4">
          The Services may integrate with third-party providers including payment processors,
          accounting systems, communications platforms and blockchain networks.
        </p>
        <p className="mb-4">Provvypay is not responsible for:</p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>third-party services;</li>
          <li>third-party outages;</li>
          <li>payment processing failures;</li>
          <li>accounting errors caused by third-party systems;</li>
          <li>blockchain network issues.</li>
        </ul>
        <p>Your use of third-party services remains subject to their own terms and policies.</p>
      </section>

      <section id="fees" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Fees</h2>
        <p className="mb-4">Certain Services may require payment of subscription fees.</p>
        <p className="mb-4">
          Fees are charged in advance and are non-refundable except where required by law.
        </p>
        <p>Provvypay may modify pricing upon reasonable notice.</p>
      </section>

      <section id="acceptable-use" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Acceptable Use</h2>
        <p className="mb-4">You must not:</p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>use the Services unlawfully;</li>
          <li>upload malicious code;</li>
          <li>interfere with platform operations;</li>
          <li>attempt unauthorised access;</li>
          <li>
            use the Services to facilitate fraud, money laundering or sanctions violations;
          </li>
          <li>infringe intellectual property rights.</li>
        </ul>
        <p>Provvypay may suspend or terminate accounts that violate these Terms.</p>
      </section>

      <section id="intellectual-property" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Intellectual Property</h2>
        <p className="mb-4">
          Provvypay and its licensors retain all rights, title and interest in the Services.
        </p>
        <p>
          Nothing in these Terms transfers ownership of the Services or underlying intellectual
          property.
        </p>
      </section>

      <section id="availability" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Availability</h2>
        <p className="mb-4">
          Provvypay aims to provide reliable Services but does not guarantee uninterrupted
          availability.
        </p>
        <p>The Services may be modified, updated or discontinued at any time.</p>
      </section>

      <section id="disclaimers" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Disclaimers</h2>
        <p className="mb-4">The Services are provided &quot;as is&quot; and &quot;as available&quot;.</p>
        <p className="mb-4">
          To the maximum extent permitted by law, Provvypay disclaims all warranties, including
          warranties regarding:
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>accuracy;</li>
          <li>fitness for purpose;</li>
          <li>uninterrupted access;</li>
          <li>merchantability.</li>
        </ul>
        <p>
          Users remain responsible for all business, legal, accounting and financial decisions.
        </p>
      </section>

      <section id="limitation-of-liability" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Limitation of Liability</h2>
        <p className="mb-4">To the maximum extent permitted by law:</p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>
            (a) Provvypay is not liable for indirect, incidental, consequential, special or punitive
            damages;
          </li>
          <li>
            (b) Provvypay&apos;s total aggregate liability arising from the Services shall not exceed
            the fees paid by the customer to Provvypay during the twelve months preceding the
            claim.
          </li>
        </ul>
        <p>Nothing in these Terms excludes rights that cannot be excluded under Australian law.</p>
      </section>

      <section id="indemnity" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Indemnity</h2>
        <p className="mb-4">You agree to indemnify Provvypay against claims arising from:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>your use of the Services;</li>
          <li>your content;</li>
          <li>your breach of these Terms;</li>
          <li>violations of law by your organisation.</li>
        </ul>
      </section>

      <section id="termination" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">14. Termination</h2>
        <p className="mb-4">You may stop using the Services at any time.</p>
        <p className="mb-4">Provvypay may suspend or terminate access where:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>these Terms are breached;</li>
          <li>continued access creates legal or security risks;</li>
          <li>required by law.</li>
        </ul>
      </section>

      <section id="governing-law" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">15. Governing Law</h2>
        <p className="mb-4">These Terms are governed by the laws of Queensland, Australia.</p>
        <p>
          The parties submit to the exclusive jurisdiction of the courts of Queensland.
        </p>
      </section>

      <section id="contact" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">16. Contact</h2>
        <p className="mb-2 font-semibold">Provvypay</p>
        <p className="mb-2">
          Email:{' '}
          <a href="mailto:hello@provvypay.com" className="text-blue-600 hover:underline">
            hello@provvypay.com
          </a>
        </p>
        <p>
          Website:{' '}
          <a href="https://www.provvypay.com" className="text-blue-600 hover:underline">
            www.provvypay.com
          </a>
        </p>
      </section>
    </LegalDocument>
  );
}
