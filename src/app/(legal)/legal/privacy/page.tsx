import LegalDocument from "@/components/legal/LegalDocument";

const sections = [
  { id: "introduction", title: "Introduction" },
  { id: "information-collected", title: "Information We Collect" },
  { id: "how-we-use", title: "How We Use Your Information" },
  { id: "legal-basis", title: "Legal Basis for Processing (GDPR)" },
  { id: "data-sharing", title: "Data Sharing and Disclosure" },
  { id: "data-security", title: "Data Security" },
  { id: "data-retention", title: "Data Retention" },
  { id: "your-rights", title: "Your Privacy Rights (GDPR)" },
  { id: "cookies", title: "Cookies and Tracking" },
  { id: "third-party", title: "Third-Party Services" },
  { id: "international", title: "International Data Transfers" },
  { id: "children", title: "Children's Privacy" },
  { id: "california", title: "California Privacy Rights (CCPA)" },
  { id: "changes", title: "Changes to This Policy" },
  { id: "contact", title: "Contact Us" },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      effectiveDate="December 15, 2025"
      lastUpdated="December 15, 2025"
      version="1.0.0"
      sections={sections}
    >
      <section id="introduction" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          1. Introduction
        </h2>
        <p className="mb-4">
          Provvypay ("we," "us," or "our") respects your privacy and is
          committed to protecting your personal data. This Privacy Policy
          explains how we collect, use, store, and protect your information when
          you use our payment processing platform.
        </p>
        <p className="mb-4">
          This Privacy Policy complies with the General Data Protection
          Regulation (GDPR), the California Consumer Privacy Act (CCPA), and
          other applicable privacy laws. By using our Service, you consent to
          the data practices described in this policy.
        </p>
        <p>
          We are the data controller responsible for your personal data. If you
          have any questions about this policy or our data practices, please
          contact us using the information provided at the end of this document.
        </p>
      </section>

      <section id="information-collected" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          2. Information We Collect
        </h2>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          2.1 Information You Provide
        </h3>
        <p className="mb-4">We collect information that you provide directly to us:</p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>
            <strong>Account Information:</strong> Name, email address, password,
            organization details, business information
          </li>
          <li>
            <strong>Payment Information:</strong> Bank account details, Stripe
            account ID, Hedera wallet addresses
          </li>
          <li>
            <strong>Transaction Data:</strong> Payment amounts, currency types,
            invoice references, customer information
          </li>
          <li>
            <strong>Integration Data:</strong> Xero account credentials, API
            keys, accounting preferences
          </li>
          <li>
            <strong>Communication Data:</strong> Messages, support requests,
            feedback
          </li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          2.2 Information Collected Automatically
        </h3>
        <p className="mb-4">When you use our Service, we automatically collect:</p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>
            <strong>Device Information:</strong> IP address, browser type,
            operating system, device identifiers
          </li>
          <li>
            <strong>Usage Data:</strong> Pages visited, features used, time
            spent, click patterns
          </li>
          <li>
            <strong>Log Data:</strong> Access times, error logs, performance
            metrics
          </li>
          <li>
            <strong>Cookies:</strong> Session cookies, preference cookies,
            analytics cookies (see our Cookie Policy)
          </li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          2.3 Information from Third Parties
        </h3>
        <p className="mb-4">We receive information from third-party services:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Stripe:</strong> Payment processing data, transaction
            status, settlement information
          </li>
          <li>
            <strong>Hedera Network:</strong> Blockchain transaction data, wallet
            balances, network confirmations
          </li>
          <li>
            <strong>Xero:</strong> Accounting data, invoice information, contact
            details
          </li>
          <li>
            <strong>Authentication Providers:</strong> Identity verification
            data, OAuth tokens
          </li>
        </ul>
      </section>

      <section id="how-we-use" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          3. How We Use Your Information
        </h2>
        <p className="mb-4">We use your information for the following purposes:</p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          3.1 Service Delivery
        </h3>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>Process and manage payment transactions</li>
          <li>Create and maintain your account</li>
          <li>Generate payment links and QR codes</li>
          <li>Facilitate cryptocurrency and card payments</li>
          <li>Sync data with accounting systems</li>
          <li>Provide customer support</li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          3.2 Security and Fraud Prevention
        </h3>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>Detect and prevent fraudulent transactions</li>
          <li>Monitor for suspicious activity</li>
          <li>Comply with anti-money laundering (AML) requirements</li>
          <li>Verify user identity</li>
          <li>Protect against unauthorized access</li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          3.3 Analytics and Improvement
        </h3>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>Analyze usage patterns and trends</li>
          <li>Improve Service performance and features</li>
          <li>Conduct research and development</li>
          <li>Generate aggregated, anonymized statistics</li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          3.4 Communication
        </h3>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>Send transaction confirmations and receipts</li>
          <li>Provide service updates and notifications</li>
          <li>Respond to inquiries and support requests</li>
          <li>Send important security alerts</li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          3.5 Legal Compliance
        </h3>
        <ul className="list-disc pl-6 space-y-2">
          <li>Comply with legal obligations and regulations</li>
          <li>Respond to law enforcement requests</li>
          <li>Enforce our Terms of Service</li>
          <li>Protect our legal rights</li>
        </ul>
      </section>

      <section id="legal-basis" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          4. Legal Basis for Processing (GDPR)
        </h2>
        <p className="mb-4">
          Under GDPR, we process your personal data based on the following legal
          grounds:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Contractual Necessity:</strong> Processing is necessary to
            perform our contract with you (providing the Service)
          </li>
          <li>
            <strong>Consent:</strong> You have given explicit consent for
            specific processing activities
          </li>
          <li>
            <strong>Legitimate Interests:</strong> Processing is necessary for
            our legitimate business interests (fraud prevention, service
            improvement, security)
          </li>
          <li>
            <strong>Legal Obligations:</strong> Processing is required to comply
            with legal and regulatory requirements
          </li>
        </ul>
      </section>

      <section id="data-sharing" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          5. Data Sharing and Disclosure
        </h2>
        <p className="mb-4">We share your information with:</p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          5.1 Service Providers
        </h3>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>
            <strong>Stripe:</strong> Payment processing and card transaction
            handling
          </li>
          <li>
            <strong>Supabase:</strong> Database hosting and authentication
            services
          </li>
          <li>
            <strong>Vercel:</strong> Website hosting and infrastructure
          </li>
          <li>
            <strong>Email Service Providers:</strong> Transactional email
            delivery
          </li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          5.2 Integrated Services
        </h3>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>
            <strong>Xero:</strong> Accounting data synchronization (with your
            explicit consent)
          </li>
          <li>
            <strong>Hedera Network:</strong> Cryptocurrency transaction
            processing (public blockchain data)
          </li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          5.3 Legal Requirements
        </h3>
        <p className="mb-4">We may disclose your information:</p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>To comply with legal obligations or court orders</li>
          <li>To respond to law enforcement requests</li>
          <li>To protect our rights, property, or safety</li>
          <li>To prevent fraud or criminal activity</li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          5.4 Business Transfers
        </h3>
        <p>
          If we are involved in a merger, acquisition, or sale of assets, your
          information may be transferred. We will provide notice before your
          information is transferred and becomes subject to a different privacy
          policy.
        </p>
      </section>

      <section id="data-security" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          6. Data Security
        </h2>
        <p className="mb-4">
          We implement comprehensive security measures to protect your data:
        </p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          6.1 Technical Measures
        </h3>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>
            <strong>Encryption:</strong> All data is encrypted in transit (TLS
            1.3) and at rest (AES-256)
          </li>
          <li>
            <strong>Access Controls:</strong> Role-based access control (RBAC)
            and multi-factor authentication
          </li>
          <li>
            <strong>Network Security:</strong> Firewalls, intrusion detection,
            and DDoS protection
          </li>
          <li>
            <strong>Secure Development:</strong> Regular security audits, code
            reviews, and vulnerability scanning
          </li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          6.2 Organizational Measures
        </h3>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>Employee training on data protection</li>
          <li>Confidentiality agreements with staff and contractors</li>
          <li>Incident response procedures</li>
          <li>Regular security awareness training</li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          6.3 PCI DSS Compliance
        </h3>
        <p>
          We comply with PCI DSS requirements by not storing card data on our
          servers. All card payments are processed through Stripe, a PCI DSS
          Level 1 certified processor.
        </p>
      </section>

      <section id="data-retention" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          7. Data Retention
        </h2>
        <p className="mb-4">We retain your data for different periods:</p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>
            <strong>Account Data:</strong> Retained while your account is active
            and for 7 years after account closure (for legal and accounting
            purposes)
          </li>
          <li>
            <strong>Transaction Data:</strong> Retained for 7 years to comply
            with financial regulations and tax requirements
          </li>
          <li>
            <strong>Communication Data:</strong> Retained for 3 years after the
            last interaction
          </li>
          <li>
            <strong>Log Data:</strong> Retained for 90 days unless required for
            security investigations
          </li>
          <li>
            <strong>Cookie Data:</strong> Varies by cookie type (see Cookie
            Policy)
          </li>
        </ul>
        <p>
          After the retention period, we securely delete or anonymize your data.
          You can request earlier deletion of certain data (see Your Rights
          section).
        </p>
      </section>

      <section id="your-rights" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          8. Your Privacy Rights (GDPR)
        </h2>
        <p className="mb-4">
          Under GDPR and other privacy laws, you have the following rights:
        </p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          8.1 Right to Access
        </h3>
        <p className="mb-4">
          You have the right to request a copy of the personal data we hold
          about you. We will provide this in a structured, commonly used, and
          machine-readable format.
        </p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          8.2 Right to Rectification
        </h3>
        <p className="mb-4">
          You have the right to correct inaccurate or incomplete personal data.
          You can update most information through your account settings.
        </p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          8.3 Right to Erasure ("Right to be Forgotten")
        </h3>
        <p className="mb-4">
          You have the right to request deletion of your personal data. This
          right is subject to certain exceptions, including:
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>We need the data to comply with legal obligations</li>
          <li>
            The data is required for establishing, exercising, or defending
            legal claims
          </li>
          <li>We have a legitimate interest that overrides your request</li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          8.4 Right to Restrict Processing
        </h3>
        <p className="mb-4">
          You have the right to request that we limit how we process your data
          in certain circumstances.
        </p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          8.5 Right to Data Portability
        </h3>
        <p className="mb-4">
          You have the right to receive your personal data in a portable format
          and to transmit it to another service provider.
        </p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          8.6 Right to Object
        </h3>
        <p className="mb-4">
          You have the right to object to processing based on legitimate
          interests or for direct marketing purposes.
        </p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          8.7 Right to Withdraw Consent
        </h3>
        <p className="mb-4">
          Where processing is based on consent, you have the right to withdraw
          consent at any time.
        </p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          8.8 How to Exercise Your Rights
        </h3>
        <p>
          To exercise any of these rights, please contact us at
          privacy@provvypay.com. We will respond to your request within 30 days.
          You also have the right to lodge a complaint with your local data
          protection authority.
        </p>
      </section>

      <section id="cookies" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          9. Cookies and Tracking
        </h2>
        <p className="mb-4">
          We use cookies and similar tracking technologies to provide and improve
          our Service. For detailed information about our cookie practices,
          please see our{" "}
          <a href="/legal/cookies" className="text-blue-600 hover:underline">
            Cookie Policy
          </a>
          .
        </p>
        <p className="mb-4">We use the following types of cookies:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Essential Cookies:</strong> Required for the Service to
            function
          </li>
          <li>
            <strong>Performance Cookies:</strong> Help us understand how you use
            the Service
          </li>
          <li>
            <strong>Functionality Cookies:</strong> Remember your preferences and
            settings
          </li>
          <li>
            <strong>Analytics Cookies:</strong> Help us improve the Service
          </li>
        </ul>
      </section>

      <section id="third-party" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          10. Third-Party Services
        </h2>
        <p className="mb-4">
          Our Service integrates with third-party services that have their own
          privacy policies:
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>
            <strong>Stripe:</strong>{" "}
            <a
              href="https://stripe.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Stripe Privacy Policy
            </a>
          </li>
          <li>
            <strong>Xero:</strong>{" "}
            <a
              href="https://www.xero.com/us/legal/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Xero Privacy Policy
            </a>
          </li>
          <li>
            <strong>Supabase:</strong>{" "}
            <a
              href="https://supabase.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Supabase Privacy Policy
            </a>
          </li>
        </ul>
        <p>
          We are not responsible for the privacy practices of third-party
          services. We encourage you to review their privacy policies.
        </p>
      </section>

      <section id="international" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          11. International Data Transfers
        </h2>
        <p className="mb-4">
          Your data may be transferred to and processed in countries other than
          your country of residence. These countries may have different data
          protection laws.
        </p>
        <p className="mb-4">
          When we transfer data internationally, we implement appropriate
          safeguards:
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>Standard Contractual Clauses (SCCs) approved by the EU Commission</li>
          <li>Adequacy decisions by relevant authorities</li>
          <li>Privacy Shield certification (where applicable)</li>
          <li>Contractual protections with service providers</li>
        </ul>
        <p>
          By using the Service, you consent to the transfer of your information
          to the United States and other countries where our service providers
          operate.
        </p>
      </section>

      <section id="children" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          12. Children's Privacy
        </h2>
        <p className="mb-4">
          Our Service is not intended for individuals under 18 years of age. We
          do not knowingly collect personal data from children. If you are a
          parent or guardian and believe your child has provided us with personal
          data, please contact us.
        </p>
        <p>
          If we discover that we have collected personal data from a child
          without parental consent, we will take steps to delete that
          information as quickly as possible.
        </p>
      </section>

      <section id="california" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          13. California Privacy Rights (CCPA)
        </h2>
        <p className="mb-4">
          If you are a California resident, you have additional rights under the
          California Consumer Privacy Act (CCPA):
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>
            <strong>Right to Know:</strong> Request disclosure of the categories
            and specific pieces of personal information we collect
          </li>
          <li>
            <strong>Right to Delete:</strong> Request deletion of your personal
            information
          </li>
          <li>
            <strong>Right to Opt-Out:</strong> Opt-out of the "sale" of your
            personal information (note: we do not sell personal information)
          </li>
          <li>
            <strong>Right to Non-Discrimination:</strong> Not receive
            discriminatory treatment for exercising your privacy rights
          </li>
        </ul>
        <p>
          To exercise these rights, contact us at privacy@provvypay.com. We will
          verify your identity before responding to your request.
        </p>
      </section>

      <section id="changes" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          14. Changes to This Policy
        </h2>
        <p className="mb-4">
          We may update this Privacy Policy from time to time. We will notify you
          of material changes by:
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>Posting the updated policy on our website</li>
          <li>Updating the "Last Updated" date</li>
          <li>Sending an email notification to your registered email address</li>
          <li>Displaying a prominent notice on the Service</li>
        </ul>
        <p>
          Your continued use of the Service after changes become effective
          constitutes acceptance of the updated Privacy Policy. We encourage you
          to review this policy periodically.
        </p>
      </section>

      <section id="contact" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">15. Contact Us</h2>
        <p className="mb-4">
          If you have questions about this Privacy Policy or want to exercise
          your privacy rights, please contact us:
        </p>
        <div className="bg-gray-50 p-6 rounded-lg">
          <p className="mb-2">
            <strong>Data Protection Officer</strong>
          </p>
          <p className="mb-2">Email: privacy@provvypay.com</p>
          <p className="mb-2">Email: dpo@provvypay.com</p>
          <p className="mb-2">Email: support@provvypay.com</p>
          <p>Address: [Your Business Address]</p>
        </div>
        <p className="mt-4 text-sm text-gray-600">
          We will respond to all requests within 30 days as required by GDPR and
          other applicable privacy laws.
        </p>
      </section>

      <div className="mt-12 p-6 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-sm text-green-900">
          <strong>Your Privacy Matters:</strong> We are committed to protecting
          your personal data and respecting your privacy rights. This policy is
          compliant with GDPR, CCPA, and other major privacy regulations. If you
          have any concerns, please don't hesitate to contact us.
        </p>
      </div>
    </LegalDocument>
  );
}







