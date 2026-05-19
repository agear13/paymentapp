import { getOperationalErrorPresentation, logOperationalError } from '@/lib/operational/log-operational-error';

describe('operational error presentation', () => {
  it('masks undefined reference errors for users', () => {
    const error = new Error('formatCurrency is not defined');
    const presentation = getOperationalErrorPresentation(error);
    expect(presentation.title).toBe('An operational UI error occurred');
    expect(presentation.message).not.toContain('formatCurrency is not defined');
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
