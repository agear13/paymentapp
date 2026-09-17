// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CommitmentRegistry} from "../src/CommitmentRegistry.sol";

contract CommitmentRegistryTest is Test {
    CommitmentRegistry internal registry;
    address internal creator = address(0xA11CE);
    address internal stranger = address(0xB0B);

    bytes32 internal constant COMMITMENT_ID = keccak256("commitment-1");
    bytes32 internal constant BUYER_HASH = keccak256("buyer");
    bytes32 internal constant SUPPLIER_HASH = keccak256("supplier");
    bytes32 internal constant SOURCE_CCY = bytes32("AUD");
    bytes32 internal constant SETTLEMENT_CCY = bytes32("AUD");
    bytes32 internal constant PURPOSE_HASH = keccak256("inventory supply");
    bytes32 internal constant TERMS_HASH = keccak256("terms-v1");
    uint256 internal constant AMOUNT = 10_000_000;
    uint64 internal constant DUE_DATE = 1_800_000_000;

    function setUp() public {
        registry = new CommitmentRegistry();
    }

    function _registerAs(address who) internal {
        vm.prank(who);
        registry.registerCommitment(
            COMMITMENT_ID,
            BUYER_HASH,
            SUPPLIER_HASH,
            AMOUNT,
            SOURCE_CCY,
            SETTLEMENT_CCY,
            DUE_DATE,
            PURPOSE_HASH,
            TERMS_HASH
        );
    }

    function test_registerCommitmentStoresValuesAndEmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit CommitmentRegistry.CommitmentRegistered(COMMITMENT_ID, creator, TERMS_HASH, AMOUNT);

        vm.prank(creator);
        registry.registerCommitment(
            COMMITMENT_ID,
            BUYER_HASH,
            SUPPLIER_HASH,
            AMOUNT,
            SOURCE_CCY,
            SETTLEMENT_CCY,
            DUE_DATE,
            PURPOSE_HASH,
            TERMS_HASH
        );

        CommitmentRegistry.Commitment memory stored = registry.getCommitment(COMMITMENT_ID);
        assertEq(stored.commitmentId, COMMITMENT_ID);
        assertEq(stored.creator, creator);
        assertEq(stored.buyerRefHash, BUYER_HASH);
        assertEq(stored.supplierRefHash, SUPPLIER_HASH);
        assertEq(stored.amountMinorUnits, AMOUNT);
        assertEq(stored.sourceCurrency, SOURCE_CCY);
        assertEq(stored.settlementCurrency, SETTLEMENT_CCY);
        assertEq(stored.dueDate, DUE_DATE);
        assertEq(stored.purposeHash, PURPOSE_HASH);
        assertEq(stored.termsHash, TERMS_HASH);
        assertEq(uint256(stored.status), uint256(CommitmentRegistry.OnchainCommitmentStatus.Registered));
        assertGt(stored.createdAt, 0);
    }

    function test_duplicateRegistrationReverts() public {
        _registerAs(creator);
        vm.prank(creator);
        vm.expectRevert(CommitmentRegistry.CommitmentAlreadyRegistered.selector);
        registry.registerCommitment(
            COMMITMENT_ID,
            BUYER_HASH,
            SUPPLIER_HASH,
            AMOUNT,
            SOURCE_CCY,
            SETTLEMENT_CCY,
            DUE_DATE,
            PURPOSE_HASH,
            TERMS_HASH
        );
    }

    function test_zeroCommitmentIdReverts() public {
        vm.prank(creator);
        vm.expectRevert(CommitmentRegistry.InvalidCommitmentId.selector);
        registry.registerCommitment(
            bytes32(0),
            BUYER_HASH,
            SUPPLIER_HASH,
            AMOUNT,
            SOURCE_CCY,
            SETTLEMENT_CCY,
            DUE_DATE,
            PURPOSE_HASH,
            TERMS_HASH
        );
    }

    function test_creatorCanUpdateStatusAndFulfillmentEmits() public {
        _registerAs(creator);

        vm.expectEmit(true, false, false, true);
        emit CommitmentRegistry.CommitmentUpdated(
            COMMITMENT_ID,
            CommitmentRegistry.OnchainCommitmentStatus.Updated
        );
        vm.prank(creator);
        registry.updateCommitmentStatus(
            COMMITMENT_ID,
            CommitmentRegistry.OnchainCommitmentStatus.Updated
        );

        vm.expectEmit(true, false, false, true);
        emit CommitmentRegistry.CommitmentUpdated(
            COMMITMENT_ID,
            CommitmentRegistry.OnchainCommitmentStatus.Fulfilled
        );
        vm.expectEmit(true, false, false, false);
        emit CommitmentRegistry.CommitmentFulfilled(COMMITMENT_ID);
        vm.prank(creator);
        registry.updateCommitmentStatus(
            COMMITMENT_ID,
            CommitmentRegistry.OnchainCommitmentStatus.Fulfilled
        );

        CommitmentRegistry.Commitment memory stored = registry.getCommitment(COMMITMENT_ID);
        assertEq(uint256(stored.status), uint256(CommitmentRegistry.OnchainCommitmentStatus.Fulfilled));
    }

    function test_nonCreatorCannotUpdateStatus() public {
        _registerAs(creator);
        vm.prank(stranger);
        vm.expectRevert(CommitmentRegistry.NotCreator.selector);
        registry.updateCommitmentStatus(
            COMMITMENT_ID,
            CommitmentRegistry.OnchainCommitmentStatus.Updated
        );
    }

    function test_updateUnknownCommitmentReverts() public {
        vm.prank(creator);
        vm.expectRevert(CommitmentRegistry.CommitmentNotFound.selector);
        registry.updateCommitmentStatus(
            COMMITMENT_ID,
            CommitmentRegistry.OnchainCommitmentStatus.Updated
        );
    }

    function test_invalidStatusReverts() public {
        _registerAs(creator);
        vm.prank(creator);
        vm.expectRevert(CommitmentRegistry.InvalidStatus.selector);
        registry.updateCommitmentStatus(
            COMMITMENT_ID,
            CommitmentRegistry.OnchainCommitmentStatus.None
        );
    }

    function test_registryHasNoTransferOrCustodyApi() public {
        bytes memory transferSelector = hex"a9059cbb"; // transfer(address,uint256)
        (bool ok,) = address(registry).call(abi.encodePacked(transferSelector, bytes32(uint256(uint160(stranger))), bytes32(uint256(1))));
        assertFalse(ok);
        assertEq(address(registry).balance, 0);
    }
}
