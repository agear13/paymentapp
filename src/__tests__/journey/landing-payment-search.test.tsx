/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { LandingPaymentSearch } from '@/components/journey/lovable/landing-payment-search';

function installDomMocks() {
  if (!window.PointerEvent) {
    class MockPointerEvent extends MouseEvent {}
    window.PointerEvent = MockPointerEvent as typeof PointerEvent;
  }
  HTMLElement.prototype.hasPointerCapture = jest.fn();
  HTMLElement.prototype.releasePointerCapture = jest.fn();
  HTMLElement.prototype.scrollIntoView = jest.fn();
}

describe('LandingPaymentSearch', () => {
  beforeEach(() => {
    installDomMocks();
  });

  it('lets anyone compare without an account, then shows a results interface', () => {
    render(<LandingPaymentSearch />);

    expect(
      screen.getByRole('heading', { name: /Tell Provvy what you're paying/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Enter the details of the transaction you want to make. Provvy will compare the available routes and explain what matters./i
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
    expect(screen.getByLabelText('What are you paying for?')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
    expect(screen.getByLabelText('Currency')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'What matters most?' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Lowest total cost' })).toBeInTheDocument();
    expect(screen.queryByText(/transaction type/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /compare routes/i })).toBeInTheDocument();
    expect(screen.queryByText(/routes found/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /connect your business/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /compare routes/i }));

    expect(screen.getByText(/payment routes found/i)).toBeInTheDocument();
    expect(screen.getByText(/Australia → Indonesia/)).toBeInTheDocument();
    expect(screen.getAllByText(/Provvy's best match/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Wise').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Airwallex').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Why #1').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /connect your business/i })[0]).toHaveAttribute(
      'href',
      '/journey/assessment'
    );
    expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/create account/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/start free trial/i)).not.toBeInTheDocument();
  });

  it('re-ranks when the visitor chooses Fastest without an account', () => {
    render(<LandingPaymentSearch />);
    fireEvent.click(screen.getByRole('button', { name: /compare routes/i }));

    const fastest = screen.getAllByRole('radio', { name: 'Fastest' });
    fireEvent.click(fastest[fastest.length - 1] as HTMLElement);

    expect(screen.getAllByRole('heading', { name: 'Digital-dollar transfer' }).length).toBeGreaterThan(
      0
    );
    expect(screen.getByText(/digital-dollar payment rail/i)).toBeInTheDocument();
    expect(screen.getAllByText('Fastest').length).toBeGreaterThan(1);
  });

  it('filters to bank transfers, clears filters, and compares selected providers', async () => {
    render(<LandingPaymentSearch />);
    fireEvent.click(screen.getByRole('button', { name: /compare routes/i }));

    fireEvent.click(screen.getByRole('button', { name: /payment method/i }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Bank transfer' }));
    expect(screen.getByText(/match your filters/i)).toBeInTheDocument();
    expect(screen.queryByText('PayPal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(screen.getByText(/payment routes found/i)).toBeInTheDocument();

    const compareBoxes = screen.getAllByRole('checkbox', { name: /compare /i });
    fireEvent.click(compareBoxes[0] as HTMLElement);
    fireEvent.click(compareBoxes[1] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: /compare selected/i }));
    expect(screen.getByRole('heading', { name: 'Compare selected' })).toBeInTheDocument();
    expect(screen.getByText('Estimated total')).toBeInTheDocument();
    expect(screen.getByText(/Provvy's view/i)).toBeInTheDocument();
  });

  it('opens a route detail that does not claim Provvy sent the payment', async () => {
    render(<LandingPaymentSearch />);
    fireEvent.click(screen.getByRole('button', { name: /compare routes/i }));
    fireEvent.click(screen.getAllByRole('button', { name: 'View route' })[0] as HTMLElement);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/does not send this payment/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /continue with wise/i })).toHaveAttribute(
      'href',
      'https://wise.com'
    );
  });

  it('updates the corridor when the destination changes', () => {
    render(<LandingPaymentSearch />);
    fireEvent.click(screen.getByRole('button', { name: /compare routes/i }));
    expect(screen.getByText(/Australia → Indonesia/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('To'), { target: { value: 'TH' } });
    expect(screen.getByText(/Australia → Thailand/)).toBeInTheDocument();
  });
});
