// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {TxSentryDemo} from "../src/TxSentryDemo.sol";

contract DeployTxSentryDemoNFT is Script {
    function run() external returns (TxSentryDemo nft) {
        vm.startBroadcast();

        nft = new TxSentryDemo();

        vm.stopBroadcast();
    }
}