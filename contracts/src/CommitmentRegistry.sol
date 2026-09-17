// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CommitmentRegistry
/// @notice Non-custodial on-chain representation of a Provvy commercial commitment.
/// @dev Does not hold or transfer funds. Does not store agreement text or PII.
contract CommitmentRegistry {
    enum OnchainCommitmentStatus {
        None,
        Registered,
        Updated,
        Fulfilled
    }

    struct Commitment {
        bytes32 commitmentId;
        address creator;
        bytes32 buyerRefHash;
        bytes32 supplierRefHash;
        uint256 amountMinorUnits;
        bytes32 sourceCurrency;
        bytes32 settlementCurrency;
        uint64 dueDate;
        bytes32 purposeHash;
        bytes32 termsHash;
        OnchainCommitmentStatus status;
        uint64 createdAt;
    }

    mapping(bytes32 commitmentId => Commitment) private commitments;

    event CommitmentRegistered(
        bytes32 indexed commitmentId,
        address indexed creator,
        bytes32 termsHash,
        uint256 amountMinorUnits
    );

    event CommitmentUpdated(bytes32 indexed commitmentId, OnchainCommitmentStatus status);

    event CommitmentFulfilled(bytes32 indexed commitmentId);

    error CommitmentAlreadyRegistered();
    error CommitmentNotFound();
    error NotCreator();
    error InvalidStatus();
    error InvalidCommitmentId();

    function registerCommitment(
        bytes32 commitmentId,
        bytes32 buyerRefHash,
        bytes32 supplierRefHash,
        uint256 amountMinorUnits,
        bytes32 sourceCurrency,
        bytes32 settlementCurrency,
        uint64 dueDate,
        bytes32 purposeHash,
        bytes32 termsHash
    ) external {
        if (commitmentId == bytes32(0)) revert InvalidCommitmentId();
        if (commitments[commitmentId].status != OnchainCommitmentStatus.None) {
            revert CommitmentAlreadyRegistered();
        }

        commitments[commitmentId] = Commitment({
            commitmentId: commitmentId,
            creator: msg.sender,
            buyerRefHash: buyerRefHash,
            supplierRefHash: supplierRefHash,
            amountMinorUnits: amountMinorUnits,
            sourceCurrency: sourceCurrency,
            settlementCurrency: settlementCurrency,
            dueDate: dueDate,
            purposeHash: purposeHash,
            termsHash: termsHash,
            status: OnchainCommitmentStatus.Registered,
            createdAt: uint64(block.timestamp)
        });

        emit CommitmentRegistered(commitmentId, msg.sender, termsHash, amountMinorUnits);
    }

    function getCommitment(bytes32 commitmentId) external view returns (Commitment memory) {
        return commitments[commitmentId];
    }

    function updateCommitmentStatus(
        bytes32 commitmentId,
        OnchainCommitmentStatus newStatus
    ) external {
        Commitment storage row = commitments[commitmentId];
        if (row.status == OnchainCommitmentStatus.None) revert CommitmentNotFound();
        if (row.creator != msg.sender) revert NotCreator();
        if (
            newStatus != OnchainCommitmentStatus.Updated &&
            newStatus != OnchainCommitmentStatus.Fulfilled
        ) {
            revert InvalidStatus();
        }

        row.status = newStatus;
        emit CommitmentUpdated(commitmentId, newStatus);
        if (newStatus == OnchainCommitmentStatus.Fulfilled) {
            emit CommitmentFulfilled(commitmentId);
        }
    }
}
