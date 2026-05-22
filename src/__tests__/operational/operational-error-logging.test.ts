import {
  getOperationalErrorPresentation,
  inferOperationalBoundaryScope,
  logOperationalError,
} from '@/lib/operational/log-operational-error';

describe('operational error presentation', () => {
  it('masks undefined reference errors for users', () => {
    const error = new Error('formatCurrency is not defined');
    const presentation = getOperationalErrorPresentation(error);
    expect(presentation.title).toBe('An operational UI error occurred');
    expect(presentation.message).not.toContain('formatCurrency is not defined');
  });

  it('uses softer copy on configuration routes', () => {
    const error = new Error('safeParticipants is not defined');
    const scope = inferOperationalBoundaryScope(
      '/dashboard/projects/onb-deal-abc/participants'
    );
    expect(scope).toBe('configuration');
    const presentation = getOperationalErrorPresentation(error, scope);
    expect(presentation.title).toMatch(/setup step/i);
    expect(presentation.message).toMatch(/still safe/i);
    expect(presentation.message).not.toContain('safeParticipants');
  });

  it('logs structured operational error payload', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Button is not defined');
    const payload = logOperationalError(error, { component: 'CreatePaymentLinkDialog' });
    expect(payload.missingSymbol).toBe('Button');
    expect(payload.component).toBe('CreatePaymentLinkDialog');
    expect(payload.timestamp).toBeTruthy();
    spy.mockRestore();
  });
});
