import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function extractModelBlock(schema: string, modelName: string): string {
  const start = schema.indexOf(`model ${modelName} {`);
  if (start === -1) return '';
  const end = schema.indexOf('\n}', start);
  return schema.slice(start, end);
}

describe('marketing subscriber preferences isolation', () => {
  const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

  it('does not modify transactional notification_preferences schema', () => {
    const block = extractModelBlock(schema, 'notification_preferences');
    expect(block).toContain('payment_confirmed_email');
    expect(block).not.toContain('marketing_unsubscribed_at');
  });

  it('stores marketing unsubscribe state on marketing_waitlist_signups instead', () => {
    const block = extractModelBlock(schema, 'marketing_waitlist_signups');
    expect(block).toContain('marketing_unsubscribed_at');
    expect(block).toContain('converted_at');
    expect(block).toContain('user_id');
  });
});
