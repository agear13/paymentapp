/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CreateDealModalProject } from '@/components/deal-network-demo/create-deal-modal-project';

describe('Commercial Workspace manual create form', () => {
  it('creates a valid workspace from a name using existing deal payload fields', async () => {
    const onCreate = jest.fn(async () => true);
    const onOpenChange = jest.fn();

    render(
      <CreateDealModalProject
        open
        onOpenChange={onOpenChange}
        onCreate={onCreate}
        copy="commercial_workspace"
      />
    );

    fireEvent.change(screen.getByLabelText('Workspace name'), {
      target: { value: 'Manual Festival' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Commercial Workspace' }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(1);
    });

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        dealName: 'Manual Festival',
        partner: 'Manual Festival',
        value: 0,
        createdVia: 'deal_network_pilot_manual',
        currentStage: 'Introduced',
        status: 'Pending',
        paymentStatus: 'Not Paid',
      })
    );
    expect(onCreate.mock.calls[0]?.[0].id).toMatch(/^demo-/);
    expect(onCreate.mock.calls[0]?.[0].paymentLink).toBeUndefined();
    expect(screen.queryByLabelText('Linked payment (optional)')).not.toBeInTheDocument();
  });

  it('keeps project-mode copy requiring partner and value', () => {
    render(
      <CreateDealModalProject open onOpenChange={jest.fn()} onCreate={jest.fn()} copy="project" />
    );

    expect(screen.getByRole('button', { name: 'Create project' })).toBeDisabled();
    expect(screen.getByLabelText('Project name')).toBeInTheDocument();
    expect(screen.getByLabelText('Linked payment (optional)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Workspace name')).not.toBeInTheDocument();
  });
});
