export type PayoutRailReadinessSnapshot = {
  merchantHederaReady: boolean;
  merchantCregisReady: boolean;
  merchantAirwallexReady: boolean;
};

export const EMPTY_PAYOUT_RAIL_READINESS: PayoutRailReadinessSnapshot = {
  merchantHederaReady: false,
  merchantCregisReady: false,
  merchantAirwallexReady: false,
};
