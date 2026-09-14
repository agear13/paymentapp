export type MarketingWaitlistSignupRecord = {
  id: string;
  email: string;
  source: string;
  landing_page: string | null;
  resend_contact_id: string | null;
  marketing_unsubscribed_at: Date | null;
  converted_at: Date | null;
  user_id: string | null;
  confirmation_email_sent_at: Date | null;
  subscriber_created_event_at: Date | null;
  subscriber_converted_event_at: Date | null;
};

export function isMarketingSubscriberActive(
  signup: Pick<
    MarketingWaitlistSignupRecord,
    'marketing_unsubscribed_at' | 'converted_at'
  >
): boolean {
  return !signup.marketing_unsubscribed_at && !signup.converted_at;
}

/** True when an active subscriber still has missing finalize side effects. */
export function isMarketingSubscriberFinalizationIncomplete(
  signup: MarketingWaitlistSignupRecord
): boolean {
  if (!isMarketingSubscriberActive(signup)) {
    return false;
  }

  return (
    !signup.resend_contact_id ||
    !signup.subscriber_created_event_at ||
    !signup.confirmation_email_sent_at
  );
}
