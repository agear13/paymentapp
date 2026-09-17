// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CommitmentRegistry} from "../src/CommitmentRegistry.sol";

/// @notice Deploys CommitmentRegistry to X Layer Testnet (chain ID 1952) only.
/// @dev Uses XLAYER_DEPLOYER_PRIVATE_KEY from the environment. Never used by the app.
contract DeployCommitmentRegistry is Script {
    uint256 internal constant XLAYER_TESTNET_CHAIN_ID = 1952;

    function run() external {
        require(block.chainid == XLAYER_TESTNET_CHAIN_ID, "Deploy only to X Layer Testnet (1952)");

        uint256 deployerKey = vm.envUint("XLAYER_DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);
        CommitmentRegistry registry = new CommitmentRegistry();
        vm.stopBroadcast();

        console2.log("chainId", block.chainid);
        console2.log("deployer", deployer);
        console2.log("CommitmentRegistry", address(registry));
    }
}
