import { toast } from 'sonner';

type MarketingToastAction = {
  label: string;
  onClick: () => void;
};

type MarketingToastInput = {
  title: string;
  description: string;
  action?: MarketingToastAction;
};

function showMarketingToast(variant: 'success' | 'message' | 'error', input: MarketingToastInput): void {
  const options = input.action
    ? {
        description: input.description,
        action: {
          label: input.action.label,
          onClick: input.action.onClick,
        },
      }
    : { description: input.description };

  if (variant === 'error') {
    toast.error(input.title, options);
    return;
  }
  if (variant === 'message') {
    toast.message(input.title, options);
    return;
  }
  toast.success(input.title, options);
}

export const marketingToasts = {
  teamStarted(scrollToCentre?: () => void) {
    showMarketingToast('success', {
      title: 'AI Marketing Team assigned',
      description:
        'Specialists are analysing your Company Brain and building the Campaign Package. Watch progress in the Command Centre.',
      action: scrollToCentre
        ? { label: 'View Command Centre', onClick: scrollToCentre }
        : undefined,
    });
  },

  packageApproved(onDispatch?: () => void) {
    showMarketingToast('success', {
      title: 'Campaign Package approved',
      description:
        'Your package is ready to send to the AI Creative Team. Dispatch when you are ready to produce Creative Assets.',
      action: onDispatch ? { label: 'Approve & Dispatch', onClick: onDispatch } : undefined,
    });
  },

  packageRevision() {
    showMarketingToast('message', {
      title: 'Campaign Package returned for revision',
      description:
        'The Marketing Lead is refining the package. Review again once specialists finish.',
    });
  },

  dispatchStarted() {
    showMarketingToast('success', {
      title: 'Dispatching to AI Creative Team',
      description:
        'Your Campaign Package is being prepared. Creative production will begin once dispatch completes.',
    });
  },

  dispatchComplete(scrollToAssets?: () => void) {
    showMarketingToast('success', {
      title: 'AI Creative Team started',
      description:
        'Creative Assets are being prepared. Import your assets.json when production is ready.',
      action: scrollToAssets
        ? { label: 'View Creative Assets', onClick: scrollToAssets }
        : undefined,
    });
  },

  assetsImported(scrollToOps?: () => void) {
    showMarketingToast('success', {
      title: 'Creative Assets ready',
      description:
        'All visual deliverables are imported. Proceed to Marketing Operations to approve publishing.',
      action: scrollToOps
        ? { label: 'Marketing Operations', onClick: scrollToOps }
        : undefined,
    });
  },

  publishingApproved() {
    showMarketingToast('success', {
      title: 'Publishing approved',
      description:
        'Your publication schedule is active. Review Campaign Insights while results are collected.',
    });
  },

  campaignGenerated() {
    showMarketingToast('success', {
      title: 'Campaign created',
      description:
        'The AI Marketing Team is planning your next campaign from Company Brain insights.',
    });
  },

  demoReset() {
    showMarketingToast('message', {
      title: 'Marketing demo reset',
      description: 'The Thirsty Turtl demo is ready to replay from the beginning.',
    });
  },

  demoStageApplied(stageLabel: string) {
    showMarketingToast('message', {
      title: `Demo: ${stageLabel}`,
      description: 'Marketing workspace updated for demonstration.',
    });
  },

  error(message: string) {
    showMarketingToast('error', {
      title: 'Something went wrong',
      description: message,
    });
  },
};
