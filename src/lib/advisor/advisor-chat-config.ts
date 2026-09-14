/** Client-visible feature flag for conversational Advisor chat. */
export function isAdvisorChatEnabledClient(): boolean {
  const value = (process.env.NEXT_PUBLIC_ADVISOR_CHAT_ENABLED || '').toLowerCase();
  return value === 'true' || value === '1';
}

/** Server-side gate for Advisor chat API. */
export function isAdvisorChatEnabledServer(): boolean {
  const server = (process.env.ADVISOR_CHAT_ENABLED || '').toLowerCase();
  if (server === 'true' || server === '1') return true;
  return isAdvisorChatEnabledClient();
}

export function getAdvisorChatModel(): string {
  return process.env.ADVISOR_CHAT_MODEL?.trim() || 'gpt-4o-mini';
}
