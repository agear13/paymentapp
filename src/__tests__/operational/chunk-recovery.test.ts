/**
 * @jest-environment jsdom
 */
import {
  decideChunkRecovery,
  isChunkLoadError,
  isScriptChunkError,
  OPERATIONAL_WORKSPACE_UPDATING_MESSAGE,
} from '@/lib/operational/chunk-recovery';
import { getOperationalErrorPresentation } from '@/lib/operational/log-operational-error';

describe('chunk recovery', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('detects webpack chunk load errors', () => {
    expect(isChunkLoadError(new Error('Loading chunk 6367 failed. (timeout)'))).toBe(true);
    expect(isChunkLoadError(new Error('network down'))).toBe(false);
  });

  it('detects script tag chunk failures', () => {
    const script = document.createElement('script');
    script.src = 'https://example.com/_next/static/chunks/app/page-abc.js';
    const event = new Event('error');
    Object.defineProperty(event, 'target', { value: script });
    expect(isScriptChunkError(event)).toBe(true);
  });

  it('reloads once for stale deploy build mismatch', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ buildId: 'deploy-b' }),
    }) as jest.Mock;

    const decision = await decideChunkRecovery(
      new Error('Loading chunk 6367 failed. (timeout)'),
      'deploy-a'
    );
    expect(decision).toEqual({ action: 'reload', reason: 'stale_deploy' });
  });

  it('does not loop after a reload was already attempted', async () => {
    sessionStorage.setItem('operational_chunk_reload_v1', '1');
    const decision = await decideChunkRecovery(
      new Error('Loading chunk 6367 failed. (timeout)'),
      'deploy-a'
    );
    expect(decision).toEqual({ action: 'fail', reason: 'already_retried' });
  });

  it('uses operational messaging instead of raw chunk errors', () => {
    const presentation = getOperationalErrorPresentation(
      new Error('Loading chunk 6367 failed. (timeout)')
    );
    expect(presentation.title).toBe('An operational UI error occurred');
    expect(presentation.message).not.toContain('Loading chunk');
    expect(OPERATIONAL_WORKSPACE_UPDATING_MESSAGE).toContain('Updating operational workspace');
  });
});
