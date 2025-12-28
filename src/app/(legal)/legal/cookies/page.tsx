import LegalDocument from "@/components/legal/LegalDocument";

const sections = [
  { id: "introduction", title: "Introduction" },
  { id: "what-are-cookies", title: "What Are Cookies?" },
  { id: "how-we-use", title: "How We Use Cookies" },
  { id: "types-of-cookies", title: "Types of Cookies We Use" },
  { id: "third-party-cookies", title: "Third-Party Cookies" },
  { id: "cookie-management", title: "Managing Cookie Preferences" },
  { id: "essential-cookies", title: "Essential Cookies" },
  { id: "analytics-cookies", title: "Analytics and Performance Cookies" },
  { id: "functionality-cookies", title: "Functionality Cookies" },
  { id: "do-not-track", title: "Do Not Track Signals" },
  { id: "changes", title: "Changes to This Policy" },
  { id: "contact", title: "Contact Us" },
];

export default function CookiePolicyPage() {
  return (
    <LegalDocument
      title="Cookie Policy"
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
          This Cookie Policy explains how Provvypay ("we," "us," or "our") uses
          cookies and similar tracking technologies on our payment processing
          platform. This policy should be read in conjunction with our Privacy
          Policy.
        </p>
        <p>
          By using our Service, you consent to the use of cookies as described
          in this policy. You can manage your cookie preferences at any time
          through your browser settings or our cookie consent banner.
        </p>
      </section>

      <section id="what-are-cookies" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          2. What Are Cookies?
        </h2>
        <p className="mb-4">
          Cookies are small text files that are stored on your device (computer,
          tablet, or mobile phone) when you visit a website. They help websites
          remember information about your visit, such as your preferences,
          login status, and browsing activity.
        </p>
        <p className="mb-4">Cookies typically include:</p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>The name of the website that created the cookie</li>
          <li>A unique identifier</li>
          <li>The cookie's expiration date</li>
          <li>Information the website wants to remember about you</li>
        </ul>
        <p>
          Similar technologies include web beacons, pixels, local storage, and
          session storage. For simplicity, we refer to all these technologies
          collectively as "cookies" in this policy.
        </p>
      </section>

      <section id="how-we-use" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          3. How We Use Cookies
        </h2>
        <p className="mb-4">We use cookies for several purposes:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <strong>Authentication:</strong> To keep you logged in and maintain
            your session
          </li>
          <li>
            <strong>Security:</strong> To protect against fraud and enhance
            platform security
          </li>
          <li>
            <strong>Preferences:</strong> To remember your settings and choices
          </li>
          <li>
            <strong>Performance:</strong> To analyze how you use the Service and
            identify improvements
          </li>
          <li>
            <strong>Functionality:</strong> To provide enhanced features and
            personalization
          </li>
          <li>
            <strong>Analytics:</strong> To understand user behavior and improve
            the Service
          </li>
        </ul>
      </section>

      <section id="types-of-cookies" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          4. Types of Cookies We Use
        </h2>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          4.1 Session Cookies
        </h3>
        <p className="mb-4">
          Session cookies are temporary cookies that expire when you close your
          browser. They help us maintain your session as you navigate through
          the Service.
        </p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          4.2 Persistent Cookies
        </h3>
        <p className="mb-4">
          Persistent cookies remain on your device for a set period or until you
          delete them. They help us remember your preferences and recognize you
          when you return to the Service.
        </p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          4.3 First-Party Cookies
        </h3>
        <p className="mb-4">
          First-party cookies are set directly by Provvypay. We use these
          cookies to provide core functionality and improve your experience.
        </p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          4.4 Third-Party Cookies
        </h3>
        <p>
          Third-party cookies are set by external services we integrate with,
          such as analytics providers and payment processors.
        </p>
      </section>

      <section id="third-party-cookies" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          5. Third-Party Cookies
        </h2>
        <p className="mb-4">
          We use third-party services that may set cookies on your device:
        </p>

        <div className="space-y-6">
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Stripe
            </h3>
            <p className="mb-2">
              <strong>Purpose:</strong> Payment processing and fraud prevention
            </p>
            <p className="mb-2">
              <strong>Data Collected:</strong> Payment information, device data,
              transaction details
            </p>
            <p>
              <strong>Privacy Policy:</strong>{" "}
              <a
                href="https://stripe.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                https://stripe.com/privacy
              </a>
            </p>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Supabase
            </h3>
            <p className="mb-2">
              <strong>Purpose:</strong> Authentication and session management
            </p>
            <p className="mb-2">
              <strong>Data Collected:</strong> Authentication tokens, session
              data
            </p>
            <p>
              <strong>Privacy Policy:</strong>{" "}
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                https://supabase.com/privacy
              </a>
            </p>
          </div>

          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Vercel Analytics
            </h3>
            <p className="mb-2">
              <strong>Purpose:</strong> Website analytics and performance
              monitoring
            </p>
            <p className="mb-2">
              <strong>Data Collected:</strong> Page views, performance metrics,
              user interactions
            </p>
            <p>
              <strong>Privacy Policy:</strong>{" "}
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                https://vercel.com/legal/privacy-policy
              </a>
            </p>
          </div>
        </div>
      </section>

      <section id="cookie-management" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          6. Managing Cookie Preferences
        </h2>
        <p className="mb-4">
          You have several options for managing cookies:
        </p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          6.1 Cookie Consent Banner
        </h3>
        <p className="mb-4">
          When you first visit our Service, you will see a cookie consent banner
          allowing you to accept or customize your cookie preferences. You can
          change these preferences at any time by clicking the "Cookie Settings"
          link in the footer.
        </p>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          6.2 Browser Settings
        </h3>
        <p className="mb-4">
          Most browsers allow you to control cookies through their settings:
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>
            <strong>Google Chrome:</strong> Settings → Privacy and security →
            Cookies and other site data
          </li>
          <li>
            <strong>Mozilla Firefox:</strong> Settings → Privacy & Security →
            Cookies and Site Data
          </li>
          <li>
            <strong>Safari:</strong> Preferences → Privacy → Cookies and website
            data
          </li>
          <li>
            <strong>Microsoft Edge:</strong> Settings → Privacy, search, and
            services → Cookies and site permissions
          </li>
        </ul>

        <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
          6.3 Impact of Blocking Cookies
        </h3>
        <p className="mb-4">
          If you block or delete cookies, some features of the Service may not
          function properly:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>You may need to log in each time you visit</li>
          <li>Your preferences may not be saved</li>
          <li>Some features may be unavailable or work incorrectly</li>
          <li>Payment processing may be affected</li>
        </ul>
      </section>

      <section id="essential-cookies" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          7. Essential Cookies
        </h2>
        <p className="mb-4">
          Essential cookies are necessary for the Service to function and cannot
          be disabled. These cookies enable core functionality such as:
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>User authentication and session management</li>
          <li>Security and fraud prevention</li>
          <li>Payment processing functionality</li>
          <li>Load balancing and performance optimization</li>
        </ul>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cookie Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Purpose
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-900">
                  sb-access-token
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  Authentication session token
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">1 hour</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-900">
                  sb-refresh-token
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  Session refresh token
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">30 days</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-900">
                  __stripe_mid
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  Fraud prevention
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">1 year</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-900">
                  __stripe_sid
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  Payment session management
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">30 minutes</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="analytics-cookies" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          8. Analytics and Performance Cookies
        </h2>
        <p className="mb-4">
          Analytics cookies help us understand how users interact with the
          Service, which pages are most popular, and how we can improve the user
          experience. These cookies are optional and can be disabled through
          your cookie preferences.
        </p>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cookie Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Purpose
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-900">
                  _vercel_analytics_id
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  Anonymous user identification for analytics
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">1 year</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-900">
                  performance_metrics
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  Page load and performance data
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">Session</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="functionality-cookies" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          9. Functionality Cookies
        </h2>
        <p className="mb-4">
          Functionality cookies remember your preferences and choices to provide
          a more personalized experience. These cookies are optional.
        </p>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cookie Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Purpose
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-900">
                  user_preferences
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  Dashboard layout and display preferences
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">1 year</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-900">
                  currency_preference
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  Preferred currency display
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">1 year</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-mono text-gray-900">
                  cookie_consent
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  Your cookie preference choices
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">1 year</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="do-not-track" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          10. Do Not Track Signals
        </h2>
        <p className="mb-4">
          Some browsers support a "Do Not Track" (DNT) feature that signals to
          websites that you do not want your online activities tracked. There is
          currently no industry standard for how to respond to DNT signals.
        </p>
        <p>
          We honor DNT signals by disabling non-essential cookies when we detect
          a DNT signal from your browser. However, this may affect the
          functionality of certain features.
        </p>
      </section>

      <section id="changes" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          11. Changes to This Policy
        </h2>
        <p className="mb-4">
          We may update this Cookie Policy from time to time to reflect changes
          in our practices, technology, legal requirements, or other factors.
        </p>
        <p className="mb-4">
          When we make material changes, we will notify you by:
        </p>
        <ul className="list-disc pl-6 space-y-2 mb-4">
          <li>Updating the "Last Updated" date at the top of this policy</li>
          <li>Displaying a notice on our Service</li>
          <li>Requesting renewed consent through our cookie banner</li>
        </ul>
        <p>
          We encourage you to review this Cookie Policy periodically to stay
          informed about how we use cookies.
        </p>
      </section>

      <section id="contact" className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Contact Us</h2>
        <p className="mb-4">
          If you have questions about our use of cookies or this Cookie Policy,
          please contact us:
        </p>
        <div className="bg-gray-50 p-6 rounded-lg">
          <p className="mb-2">
            <strong>Provvypay</strong>
          </p>
          <p className="mb-2">Email: privacy@provvypay.com</p>
          <p className="mb-2">Email: support@provvypay.com</p>
          <p>Address: [Your Business Address]</p>
        </div>
      </section>

      <div className="mt-12 p-6 bg-purple-50 border border-purple-200 rounded-lg">
        <h3 className="text-lg font-semibold text-purple-900 mb-3">
          Quick Cookie Guide
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="font-semibold text-purple-900 mb-2">
              Essential Cookies
            </p>
            <p className="text-purple-800">
              Required for the site to work. Cannot be disabled.
            </p>
          </div>
          <div>
            <p className="font-semibold text-purple-900 mb-2">
              Analytics Cookies
            </p>
            <p className="text-purple-800">
              Help us improve the site. Can be disabled in settings.
            </p>
          </div>
          <div>
            <p className="font-semibold text-purple-900 mb-2">
              Functionality Cookies
            </p>
            <p className="text-purple-800">
              Remember your preferences. Can be disabled in settings.
            </p>
          </div>
        </div>
      </div>
    </LegalDocument>
  );
}







