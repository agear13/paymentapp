/**
 * Commercial Domain → Commercial Network boundary.
 *
 * The Commercial Domain must not talk to persistence or shared-workflow
 * networks directly. All shared-state synchronization goes through
 * `@/lib/commercial-network`.
 *
 * Re-export the domain-facing facade so commercial modules have a single
 * import path for network operations.
 */

export {
  openCommercialNetwork,
  resolveCommercialNetworkProvider,
  type CommercialNetwork,
  type CommercialNetworkScope,
  type OpenCommercialNetworkOptions,
} from '@/lib/commercial-network/commercial-network';
