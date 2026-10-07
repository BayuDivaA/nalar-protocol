// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {NalarCollection} from "../src/NalarCollection.sol";
import {NalarMintTrap} from "../src/NalarMintTrap.sol";

contract DeployNalarCollection is Script {
    function run() external returns (NalarCollection collection, NalarMintTrap trap) {
        require(block.chainid == 97, "BNB Testnet only");
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        uint256 mintPrice = vm.envOr("NALAR_MINT_PRICE_WEI", uint256(0));
        address treasury = vm.addr(privateKey);

        vm.startBroadcast(privateKey);
        collection = new NalarCollection(mintPrice, treasury);
        trap = new NalarMintTrap(address(collection));
        vm.stopBroadcast();

        console2.log("NalarCollection", address(collection));
        console2.log("NalarMintTrap", address(trap));
    }
}
