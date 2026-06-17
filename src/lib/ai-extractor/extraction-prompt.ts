const EXTRACTION_SCHEMA = `{
  "projectName": { "value": "string | null", "confidence": "high|medium|low|absent", "rawSnippet": "string?" },
  "projectDescription": { "value": "string | null", "confidence": "high|medium|low|absent", "rawSnippet": "string?" },
  "projectValue": { "value": "number | null", "confidence": "high|medium|low|absent", "rawSnippet": "string?" },
  "currency": { "value": "string", "confidence": "high|medium|low|absent" },
  "counterparty": { "value": "string | null", "confidence": "high|medium|low|absent" },
  "agreementType": { "value": "MULTI_PARTY_EVENT_COORDINATION|EVENT_REVENUE_SHARE|FIXED_FEE_SERVICE|CUSTOMER_ATTRIBUTION|OTHER|null", "confidence": "high|medium|low|absent" },
  "parties": [
    {
      "id": "string",
      "name": { "value": "string", "confidence": "high|medium|low|absent", "rawSnippet": "string?" },
      "email": { "value": "string | null", "confidence": "high|medium|low|absent" },
      "role": { "value": "string", "confidence": "high|medium|low|absent" },
      "participationModel": { "value": "fixed_payout|revenue_share|hybrid|customer_attribution", "confidence": "high|medium|low|absent" },
      "fixedAmount": { "value": "number | null", "confidence": "high|medium|low|absent", "rawSnippet": "string?" },
      "revenueSharePct": { "value": "number | null", "confidence": "high|medium|low|absent", "rawSnippet": "string?" },
      "deliverables": [
        {
          "description": { "value": "string", "confidence": "high|medium|low|absent" },
          "category": { "value": "MARKETING|PHOTOGRAPHY|VIDEOGRAPHY|GRAPHIC_DESIGN|VENUE|EVENT_MANAGEMENT|TALENT|SPONSORSHIP|OPERATIONS|OTHER|null", "confidence": "high|medium|low|absent" }
        }
      ],
      "conditionalPayments": [
        {
          "trigger": { "value": "string", "confidence": "high|medium|low|absent", "rawSnippet": "string?" },
          "amount": { "value": "number|null", "confidence": "high|medium|low|absent", "rawSnippet": "string?" }
        }
      ],
      "milestones": [
        {
          "description": { "value": "string", "confidence": "high|medium|low|absent" },
          "deadline": { "value": "string | null", "confidence": "high|medium|low|absent" },
          "category": { "value": "financial|performance", "confidence": "high|medium|low|absent" },
          "status": "draft|confirmed|pending|conditional|fulfilled|disputed"
        }
      ],
      "serviceCategories": { "value": ["MARKETING|PHOTOGRAPHY|VIDEOGRAPHY|GRAPHIC_DESIGN|VENUE|EVENT_MANAGEMENT|TALENT|SPONSORSHIP|OPERATIONS|OTHER"], "confidence": "high|medium|low|absent" },
      "conditions": [{ "description": { "value": "string" }, "dependsOn": { "value": "string|null" }, "status": "pending" }],
      "dependencies": [{ "obligation": { "value": "string" }, "dependsOn": { "value": "string" }, "status": "pending" }],
      "notes": { "value": "string | null", "confidence": "high|medium|low|absent" }
    }
  ],
  "settlementRules": [
    {
      "trigger": { "value": "string", "confidence": "high|medium|low|absent", "rawSnippet": "string?" },
      "basis": { "value": "string|null", "confidence": "high|medium|low|absent" }
    }
  ],
  "settlementEvents": [
    {
      "partyId": "string",
      "partyName": "string",
      "type": "fixed_fee|revenue_share|bonus|milestone|attribution",
      "amount": { "value": "number|null" },
      "percentage": { "value": "number|null" },
      "trigger": { "value": "string|null" },
      "condition": { "value": "string|null" },
      "status": "draft|confirmed|pending|conditional|fulfilled|disputed"
    }
  ],
  "paymentTerms": [
    {
      "description": { "value": "string", "confidence": "high|medium|low|absent" },
      "amount": { "value": "number | null", "confidence": "high|medium|low|absent" },
      "currency": { "value": "string", "confidence": "high|medium|low|absent" },
      "dueCondition": { "value": "string | null", "confidence": "high|medium|low|absent" }
    }
  ],
  "uncertainties": [
    { "field": "string", "issue": "string", "snippet": "string?" }
  ],
  "overallConfidence": "high|medium|low|absent",
  "sourceHint": "string | null",
  "extractedAt": "ISO 8601 timestamp string",
  "schemaVersion": "v4"
}`;

export function buildExtractionSystemPrompt(): string {
  return `You are an agreement extraction assistant for a payment and project management platform called Provvypay.
Your task: read a pasted conversation (WhatsApp, Messenger, SMS, email, Slack, or meeting notes) and extract structured obligation intelligence — not a narrative summary.

Return ONLY a valid JSON object conforming exactly to the schema below. Do not add prose, markdown, or code fences. All fields are required; use null for values not found in the text. Confidence values must be exactly one of: "high", "medium", "low", "absent".

EXTRACTION RULES:

1. Only create a party entry for a person or entity if the conversation contains explicit evidence of a financial entitlement for that person. Qualifying evidence includes:
   - A specific payout amount or fee agreed to them
   - A revenue share or profit share percentage allocated to them
   - A commission entitlement tied to sales or referrals
   - A customer attribution arrangement (they earn when their referred customers transact)
   Do NOT create a party entry merely because someone is named, mentioned, sends a message, or is part of the conversation.

2. For each qualifying party, determine their participation model:
   - "fixed_payout" — only a specific dollar/currency amount is agreed for that person
   - "revenue_share" — only a percentage of revenue, tickets, bar, sponsorship, or deal value is mentioned
   - "hybrid" — BOTH a fixed fee/amount AND a revenue share percentage are agreed for the same person
   - "customer_attribution" — they earn from referrals or commissions with no explicit fixed amount or percentage of project value
   IMPORTANT: project budget or total contract value is NOT a participant payment. Never put the overall project budget in fixedAmount.

3. Conditional bonuses (e.g. "+$150 if attendance exceeds 500") belong in conditionalPayments[] — NOT revenueSharePct and NOT notes.

4. Extract currency only when explicitly stated in the text (ISO codes such as AUD, USD, GBP, EUR, NZD, IDR, SGD). If absent, set currency confidence to "absent" and value to null — do not guess a default.

5. Service categories — use normalized enum values in serviceCategories[] and deliverables[].category:
   MARKETING, PHOTOGRAPHY, VIDEOGRAPHY, GRAPHIC_DESIGN, VENUE, EVENT_MANAGEMENT, TALENT, SPONSORSHIP, OPERATIONS, OTHER
   Infer categories from deliverables and services performed. Do NOT default everyone to Promoter/Contractor when specific services are evident.

6. Deliverables — extract every service output as a structured deliverables[] object with description and category. Do NOT bury deliverables in notes.

7. Settlement rules — ONLY populate settlementRules[] when settlement timing is EXPLICITLY stated in source text (e.g. "within 7 days after event", "within 14 days after sponsor funds clear").
   NEVER invent: monthly settlement, net sales basis, after processing fees, on completion, deliverable completion triggers.
   Each rule must include rawSnippet quoting the source phrase.

8. Agreement type — classify agreementType based on participant count, revenue shares, fixed fees, deliverables, and event context:
   MULTI_PARTY_EVENT_COORDINATION, EVENT_REVENUE_SHARE, FIXED_FEE_SERVICE, CUSTOMER_ATTRIBUTION, or OTHER.

9. Obligation model (required output structure per party):
   Participant → deliverables[] → fixedAmount/revenueSharePct → conditionalPayments[] → settlementRules (project-level)

10. Keep output compact to avoid truncation:
    - Omit rawSnippet when confidence is "absent" or the value is null.
    - rawSnippet: max 120 characters (short quote from the conversation).
    - notes: max 200 characters — context only, not deliverables or payment terms.
    - Do not repeat the full conversation in any field.

11. Generate a short unique id for each party using the pattern "ep-1", "ep-2", etc.

12. Set extractedAt to the current ISO 8601 timestamp and schemaVersion to "v4".

SCHEMA:
${EXTRACTION_SCHEMA}`;
}

export function buildExtractionUserPrompt(rawText: string): string {
  return `Extract agreement information from the following conversation text.

<conversation>
${rawText}
</conversation>

Return only the JSON object. No other text.`;
}
