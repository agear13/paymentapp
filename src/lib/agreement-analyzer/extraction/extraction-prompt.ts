export const AGREEMENT_STRUCTURED_EXTRACTION_SYSTEM_PROMPT = `You are a commercial agreement analyst for Provvypay.
Extract structured obligation and payment information from agreement text.
Return only valid JSON matching the required schema.
Use empty arrays when a section has no evidence.
confidenceScore must be between 0 and 1 reflecting overall extraction certainty.`;

export function buildStructuredExtractionUserPrompt(documentText: string): string {
  return `Analyze the following commercial agreement text and return JSON with this exact shape:
{
  "documentType": "",
  "parties": [],
  "roles": [],
  "revenueSplits": [],
  "paymentConditions": [],
  "obligations": [],
  "risks": [],
  "missingInformation": [],
  "confidenceScore": 0.0
}

Guidance:
- parties: name, entity type, and contact hints when present
- roles: commercial roles and responsibilities
- revenueSplits: percentages, beneficiaries, triggers
- paymentConditions: when/how payments occur
- obligations: concrete duties, deadlines, amounts
- risks: legal, operational, or settlement risks
- missingInformation: clauses or data needed for settlement readiness
- confidenceScore: 0.0-1.0 overall confidence

Agreement text:
---
${documentText}
---`;
}

export const AGREEMENT_VISION_TEXT_SYSTEM_PROMPT = `You transcribe commercial agreement documents from images.
Return only the full readable text from the document, preserving section order.
Do not summarize. Do not add commentary.`;

export const AGREEMENT_RELATIONSHIP_CLASSIFICATION_SYSTEM_PROMPT = `You classify commercial agreement relationship types for Provvypay.
Return only valid JSON with a single documentType field.
Use a concise slug such as promoter-revenue-share, venue-hire, or contractor.`;

export const AGREEMENT_EXECUTIVE_SUMMARY_SYSTEM_PROMPT = `You write executive summaries for commercial agreement obligation reports on Provvypay.
Your audience is venue operators, promoters, hospitality groups, accountants, and event managers.
Use plain English. Avoid legal jargon. Be concise and commercially focused.
Never exceed 150 words total across summary, keyFindings, and operationalImpact.
Focus on settlement and payment operations — not legal advice.
Return only valid JSON matching the required schema.
Base your summary ONLY on the structured extraction data provided — never invent facts not present in the input.`;

export function buildExecutiveSummaryUserPrompt(structuredInputJson: string): string {
  return `Write an executive summary from this structured agreement extraction output.
Answer: agreement type, parties, obligation count, settlement readiness, top risks, missing information, and operational impact.

Return JSON with this exact shape:
{
  "headline": "",
  "summary": "",
  "keyFindings": [],
  "operationalImpact": ""
}

Guidance:
- headline: short agreement type label (e.g. "Revenue Sharing Agreement")
- summary: 2-3 sentences covering parties, obligation count, settlement rules, and readiness score
- keyFindings: up to 5 plain-English bullets on the most important risks and missing information
- operationalImpact: one sentence on why gaps matter for manual settlement management
- Keep total word count under 150 words

Structured extraction data:
---
${structuredInputJson}
---`;
}

export function buildRelationshipClassificationUserPrompt(documentText: string): string {
  return `Classify the commercial relationship type in the following agreement text.
Return JSON with this exact shape:
{
  "documentType": ""
}

Agreement text:
---
${documentText}
---`;
}

