import Script from 'next/script';
import { getGaMeasurementId } from '@/lib/analytics/ga-measurement-id';

/**
 * Central GA4 Google tag (gtag.js), not Google Tag Manager.
 *
 * Page views: gtag config sends the initial page_view. GA4 enhanced measurement
 * records App Router navigations via the History API. Do not add a manual
 * page_view listener here — that would double-count.
 *
 * Consent: default analytics_storage is denied unless the existing
 * cookie_consent localStorage value already granted analytics. CookieConsent
 * updates gtag consent after the user chooses.
 *
 * Do not send emails, names, agreement contents, financial data, participant
 * records, or other private application data to GA4.
 */
const GoogleAnalytics = () => {
  const measurementId = getGaMeasurementId();
  if (!measurementId) return null;

  return (
    <>
      <Script id="ga4-consent-default" strategy="beforeInteractive">
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
var analyticsGranted = false;
try {
  var saved = JSON.parse(localStorage.getItem('cookie_consent') || '');
  analyticsGranted = !!(saved && saved.analytics === true);
} catch (e) {}
gtag('consent', 'default', {
  analytics_storage: analyticsGranted ? 'granted' : 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied'
});
        `}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-gtag" strategy="afterInteractive">
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = window.gtag || gtag;
gtag('js', new Date());
gtag('config', '${measurementId}', {
  send_page_view: true,
  allow_google_signals: false,
  allow_ad_personalization_signals: false
});
        `}
      </Script>
    </>
  );
};

export default GoogleAnalytics;
