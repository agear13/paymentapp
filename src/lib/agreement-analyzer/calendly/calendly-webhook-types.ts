export type CalendlyInviteeWebhookPayload = {
  uri?: string;
  email?: string;
  name?: string;
  scheduled_event?: {
    uri?: string;
    start_time?: string;
    end_time?: string;
  };
  tracking?: {
    utm_campaign?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
    salesforce_uuid?: string | null;
  };
  questions_and_answers?: Array<{
    question?: string;
    answer?: string;
  }>;
};

export type CalendlyWebhookBody = {
  event?: string;
  payload?: CalendlyInviteeWebhookPayload;
};
