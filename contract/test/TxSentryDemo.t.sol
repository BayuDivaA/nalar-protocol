// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    Test
} from "forge-std/Test.sol";

import {
    TxSentryDemo
} from "../src/TxSentryDemo.sol";

contract TxSentryDemoTest is Test {
    TxSentryDemo nft;

    address user =
        address(0x1111);

    address operator =
        address(0x2222);

    function setUp() public {
        nft = new TxSentryDemo();
    }

    function testSafeMint() public {
        vm.deal(user, 1 ether);

        vm.prank(user);

        nft.safeMint{
            value: 0.02 ether
        }();

        assertEq(
            nft.ownerOf(0),
            user
        );
    }

    function testSafeMintWrongPrice()
        public
    {
        vm.deal(user, 1 ether);

        vm.prank(user);

        vm.expectRevert(
            TxSentryDemo.WrongMintPrice.selector
        );

        nft.safeMint{
            value: 0.01 ether
        }();
    }

    function testMaliciousApproval()
        public
    {
        vm.prank(user);

        nft.maliciousApproval(
            operator
        );

        assertTrue(
            nft.isApprovedForAll(
                user,
                operator
            )
        );
    }
}