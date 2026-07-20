/**
 * Local persistence port.
 *
 * Decouples the Local Commercial Network Provider from Prisma / pilot-snapshot.
 * Production can bind this port to existing Provvypay persistence;
 * tests use an in-memory implementation.
 *
 * The Commercial Domain never imports this port — only the Local Provider does.
 */

import type {
  SharedCommercialAgreement,
  SharedCommercialParticipant,
  SharedCommercialSnapshot,
} from '@/lib/commercial-network/types';

export type LocalPersistencePort = {
  getAgreement(agreementId: string): Promise<SharedCommercialAgreement | null>;

  upsertAgreement(agreement: SharedCommercialAgreement): Promise<SharedCommercialAgreement>;

  getParticipant(participantId: string): Promise<SharedCommercialParticipant | null>;

  upsertParticipant(
    participant: SharedCommercialParticipant
  ): Promise<SharedCommercialParticipant>;

  /**
   * Full snapshot sync for an owner (mirrors syncPilotSnapshotForUser scope).
   */
  synchronizeSnapshot(input: {
    ownerUserId?: string | null;
    organizationId?: string | null;
    snapshot: SharedCommercialSnapshot;
  }): Promise<SharedCommercialSnapshot>;

  loadSnapshot(input: {
    ownerUserId?: string | null;
    organizationId?: string | null;
    agreementId?: string;
  }): Promise<SharedCommercialSnapshot>;
};

/**
 * In-memory Local persistence — preserves Local Provider behaviour in tests
 * and environments without Prisma binding.
 */
export function createInMemoryLocalPersistencePort(): LocalPersistencePort {
  const agreements = new Map<string, SharedCommercialAgreement>();
  const participants = new Map<string, SharedCommercialParticipant>();

  return {
    async getAgreement(agreementId) {
      return agreements.get(agreementId) ?? null;
    },

    async upsertAgreement(agreement) {
      agreements.set(agreement.agreementId, agreement);
      return agreement;
    },

    async getParticipant(participantId) {
      return participants.get(participantId) ?? null;
    },

    async upsertParticipant(participant) {
      participants.set(participant.participantId, participant);
      return participant;
    },

    async synchronizeSnapshot({ snapshot }) {
      for (const a of snapshot.agreements) {
        agreements.set(a.agreementId, a);
      }
      for (const p of snapshot.participants) {
        participants.set(p.participantId, p);
      }
      return snapshot;
    },

    async loadSnapshot({ ownerUserId, organizationId, agreementId }) {
      let agreementList = [...agreements.values()];
      if (agreementId) {
        agreementList = agreementList.filter((a) => a.agreementId === agreementId);
      } else if (ownerUserId) {
        agreementList = agreementList.filter((a) => a.ownerUserId === ownerUserId);
      } else if (organizationId) {
        agreementList = agreementList.filter((a) => a.organizationId === organizationId);
      }
      const agreementIds = new Set(agreementList.map((a) => a.agreementId));
      const participantList = [...participants.values()].filter((p) =>
        agreementIds.has(p.agreementId)
      );
      return { agreements: agreementList, participants: participantList };
    },
  };
}
