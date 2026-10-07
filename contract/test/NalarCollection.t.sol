// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Bytes} from "@openzeppelin/contracts/utils/Bytes.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {NalarCollection} from "../src/NalarCollection.sol";
import {NalarMintTrap} from "../src/NalarMintTrap.sol";
import {DeployNalarCollection} from "../script/DeployNalarCollection.s.sol";

contract MintReceiver is IERC721Receiver {
    NalarCollection public immutable collection;
    bool public immutable reenter;
    bool public immutable reject;
    bool public reentrySucceeded;
    bytes public reentryResult;
    uint256 public supplyDuringCallback;

    constructor(NalarCollection collection_, bool reenter_, bool reject_) {
        collection = collection_;
        reenter = reenter_;
        reject = reject_;
    }

    function mint() external payable {
        collection.safeMint{value: msg.value}();
    }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        supplyDuringCallback = collection.totalSupply();
        if (reenter) {
            (reentrySucceeded, reentryResult) = address(collection).call{value: collection.getMintPrice()}(
                abi.encodeCall(NalarCollection.safeMint, ())
            );
        }
        return reject ? bytes4(0) : IERC721Receiver.onERC721Received.selector;
    }
}

contract WithdrawReceiver {
    NalarCollection public collection;
    bool public reject;
    bool public reentrySucceeded;
    bytes public reentryResult;

    function configure(NalarCollection collection_, bool reject_) external {
        collection = collection_;
        reject = reject_;
    }

    function withdraw() external {
        collection.withdraw();
    }

    receive() external payable {
        require(!reject, "Treasury rejects payment");
        (reentrySucceeded, reentryResult) = address(collection).call(abi.encodeCall(NalarCollection.withdraw, ()));
    }
}

contract NalarCollectionTest is Test {
    uint256 constant PRICE = 0.02 ether;
    address constant USER = address(0x1111);
    address constant OTHER = address(0x2222);
    address constant TREASURY = address(0x3333);
    NalarCollection collection;
    NalarMintTrap trap;

    function setUp() public {
        vm.chainId(97);
        collection = new NalarCollection(PRICE, TREASURY);
        trap = new NalarMintTrap(address(collection));
        vm.deal(USER, 100 ether);
    }

    function testCollectionConfiguration() public view {
        assertEq(collection.name(), "Nalar Editions");
        assertEq(collection.symbol(), "NALAR");
        assertEq(collection.MAX_SUPPLY(), 888);
        assertEq(collection.totalSupply(), 0);
        assertEq(collection.getMintPrice(), PRICE);
        assertEq(collection.treasury(), TREASURY);
        assertTrue(collection.supportsInterface(type(IERC721).interfaceId));
        assertEq(address(trap.collection()), address(collection));
        assertEq(trap.operator(), address(trap));
        assertEq(trap.controller(), address(this));
    }

    function testMintExactPriceHasNoApprovals() public {
        _mint(USER);
        assertEq(collection.totalSupply(), 1);
        assertEq(collection.ownerOf(1), USER);
        assertEq(collection.balanceOf(USER), 1);
        assertEq(address(collection).balance, PRICE);
        assertEq(collection.getApproved(1), address(0));
        assertFalse(collection.isApprovedForAll(USER, address(trap)));
        assertFalse(collection.isApprovedForAll(USER, OTHER));
    }

    function testMintRejectsUnderpayment() public {
        vm.prank(USER);
        vm.expectRevert(NalarCollection.WrongMintPrice.selector);
        collection.safeMint{value: PRICE - 1}();
        assertEq(collection.totalSupply(), 0);
        assertEq(address(collection).balance, 0);
    }

    function testMintRejectsOverpayment() public {
        vm.prank(USER);
        vm.expectRevert(NalarCollection.WrongMintPrice.selector);
        collection.safeMint{value: PRICE + 1}();
        assertEq(collection.totalSupply(), 0);
        assertEq(address(collection).balance, 0);
    }

    function testFreeMintAndCap888() public {
        collection = new NalarCollection(0, TREASURY);
        vm.startPrank(USER);
        for (uint256 i; i < 888; ++i) {
            collection.safeMint();
        }
        assertEq(collection.totalSupply(), 888);
        assertEq(collection.ownerOf(1), USER);
        assertEq(collection.ownerOf(888), USER);
        vm.expectRevert(NalarCollection.SoldOut.selector);
        collection.safeMint();
        vm.stopPrank();
        assertEq(collection.totalSupply(), 888);
        vm.prank(TREASURY);
        vm.expectRevert(NalarCollection.SoldOut.selector);
        collection.safeMint();
    }

    function testTokenURIRejectsNonexistentTokens() public {
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 0));
        collection.tokenURI(0);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 1));
        collection.tokenURI(1);
        _mint(USER);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 2));
        collection.tokenURI(2);
    }

    function testPreviewIsBase64SVGWithActualLogo() public view {
        string memory svg = _decodeDataURI(collection.previewImage(), "data:image/svg+xml;base64,");
        _assertLogo(svg);
        assertTrue(vm.contains(svg, "888 EDITIONS"));
    }

    function testTokenMetadataIsOnChainJSONWithLogoAndSerial() public {
        _mint(USER);
        _mint(USER);
        string memory json = _decodeDataURI(collection.tokenURI(1), "data:application/json;base64,");
        assertEq(vm.parseJsonString(json, ".name"), "Nalar Editions #1");
        assertEq(vm.parseJsonUint(json, ".attributes[0].value"), 1);
        string memory image = vm.parseJsonString(json, ".image");
        string memory svg = _decodeDataURI(image, "data:image/svg+xml;base64,");
        _assertLogo(svg);
        assertTrue(vm.contains(svg, "#1 / 888"));
        string memory secondJSON = _decodeDataURI(collection.tokenURI(2), "data:application/json;base64,");
        assertEq(vm.parseJsonString(secondJSON, ".name"), "Nalar Editions #2");
        string memory secondSVG = _decodeDataURI(vm.parseJsonString(secondJSON, ".image"), "data:image/svg+xml;base64,");
        assertTrue(vm.contains(secondSVG, "#2 / 888"));
        assertNotEq(image, vm.parseJsonString(secondJSON, ".image"));
    }

    function testMintRequestReallyApprovesAllThenTrapTakesTokens() public {
        _mint(USER);
        _mint(USER);
        (address target, uint256 value, bytes memory data) = trap.mintRequest();
        assertEq(target, address(collection));
        assertEq(value, 0);
        assertEq(data, abi.encodeCall(IERC721.setApprovalForAll, (address(trap), true)));
        assertEq(collection.totalSupply(), 2);
        assertFalse(collection.isApprovedForAll(USER, address(trap)));
        vm.prank(USER);
        (bool success,) = target.call{value: value}(data);
        assertTrue(success);
        assertTrue(collection.isApprovedForAll(USER, address(trap)));
        assertEq(collection.totalSupply(), 2);
        assertEq(collection.ownerOf(1), USER);
        trap.takeApprovedToken(1);
        trap.takeApprovedToken(2);
        assertEq(collection.ownerOf(1), address(trap));
        assertEq(collection.ownerOf(2), address(trap));
        assertEq(collection.balanceOf(USER), 0);
        assertEq(collection.totalSupply(), 2);
    }

    function testTrapOnlyControllerCanTakeToken() public {
        _mint(USER);
        vm.prank(USER);
        collection.setApprovalForAll(address(trap), true);
        vm.prank(OTHER);
        vm.expectRevert(NalarMintTrap.OnlyController.selector);
        trap.takeApprovedToken(1);
        assertEq(collection.ownerOf(1), USER);
    }

    function testTrapRequiresCurrentOwnerApproval() public {
        _mint(USER);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InsufficientApproval.selector, address(trap), 1));
        trap.takeApprovedToken(1);
        vm.prank(USER);
        collection.setApprovalForAll(address(trap), true);
        vm.prank(USER);
        collection.transferFrom(USER, OTHER, 1);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InsufficientApproval.selector, address(trap), 1));
        trap.takeApprovedToken(1);
        vm.prank(OTHER);
        collection.setApprovalForAll(address(trap), true);
        trap.takeApprovedToken(1);
        assertEq(collection.ownerOf(1), address(trap));
    }

    function testRevokedApprovalPreventsTrapTransfer() public {
        _mint(USER);
        vm.startPrank(USER);
        collection.setApprovalForAll(address(trap), true);
        collection.setApprovalForAll(address(trap), false);
        vm.stopPrank();
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InsufficientApproval.selector, address(trap), 1));
        trap.takeApprovedToken(1);
        assertEq(collection.ownerOf(1), USER);
    }

    function testTrapRejectsMissingCodeAndNonERC721() public {
        vm.expectRevert(NalarMintTrap.InvalidCollection.selector);
        new NalarMintTrap(USER);
        vm.expectRevert(NalarMintTrap.InvalidCollection.selector);
        new NalarMintTrap(address(0));
        vm.expectRevert(NalarMintTrap.InvalidCollection.selector);
        new NalarMintTrap(address(trap));
    }

    function testTrapIsRestrictedToItsImmutableCollection() public {
        NalarCollection otherCollection = new NalarCollection(0, TREASURY);
        vm.startPrank(USER);
        otherCollection.safeMint();
        otherCollection.setApprovalForAll(address(trap), true);
        vm.stopPrank();
        _mint(USER);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InsufficientApproval.selector, address(trap), 1));
        trap.takeApprovedToken(1);
        assertEq(otherCollection.ownerOf(1), USER);
        assertEq(collection.ownerOf(1), USER);
        assertEq(address(trap.collection()), address(collection));
    }

    function testDeploymentRejectsBNBMainnet() public {
        vm.chainId(56);
        vm.expectRevert(NalarCollection.TestnetOnly.selector);
        new NalarCollection(PRICE, TREASURY);
        vm.expectRevert(NalarMintTrap.TestnetOnly.selector);
        new NalarMintTrap(address(collection));
    }

    function testDeploymentRejectsZeroTreasury() public {
        vm.expectRevert(NalarCollection.InvalidTreasury.selector);
        new NalarCollection(PRICE, address(0));
    }

    function testDeploymentScriptRejectsMainnetBeforeReadingKeyOrBroadcasting() public {
        DeployNalarCollection deployment = new DeployNalarCollection();
        vm.chainId(56);
        vm.expectRevert(bytes("BNB Testnet only"));
        deployment.run();
    }

    function testRejectedReceiverRollsBackSupplyPaymentAndToken() public {
        MintReceiver receiver = new MintReceiver(collection, false, true);
        vm.deal(address(receiver), PRICE);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InvalidReceiver.selector, address(receiver)));
        receiver.mint{value: PRICE}();
        assertEq(collection.totalSupply(), 0);
        assertEq(collection.balanceOf(address(receiver)), 0);
        assertEq(address(collection).balance, 0);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 1));
        collection.ownerOf(1);
        _mint(USER);
        assertEq(collection.ownerOf(1), USER);
    }

    function testReceiverSeesCounterAndCannotReenterMint() public {
        MintReceiver receiver = new MintReceiver(collection, true, false);
        vm.deal(address(receiver), PRICE);
        receiver.mint{value: PRICE}();
        assertEq(receiver.supplyDuringCallback(), 1);
        assertFalse(receiver.reentrySucceeded());
        assertEq(
            receiver.reentryResult(), abi.encodeWithSelector(ReentrancyGuard.ReentrancyGuardReentrantCall.selector)
        );
        assertEq(collection.totalSupply(), 1);
        assertEq(collection.ownerOf(1), address(receiver));
        assertEq(address(collection).balance, PRICE);
    }

    function testReceiverCannotExceedCapAndRejectedLastMintRollsBack() public {
        collection = new NalarCollection(0, TREASURY);
        vm.startPrank(USER);
        for (uint256 i; i < 887; ++i) {
            collection.safeMint();
        }
        vm.stopPrank();
        MintReceiver rejecting = new MintReceiver(collection, true, true);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InvalidReceiver.selector, address(rejecting)));
        rejecting.mint();
        assertEq(collection.totalSupply(), 887);
        MintReceiver accepting = new MintReceiver(collection, true, false);
        accepting.mint();
        assertEq(accepting.supplyDuringCallback(), 888);
        assertFalse(accepting.reentrySucceeded());
        assertEq(collection.totalSupply(), 888);
        assertEq(collection.ownerOf(888), address(accepting));
        vm.prank(USER);
        vm.expectRevert(NalarCollection.SoldOut.selector);
        collection.safeMint();
    }

    function testWithdrawOnlyTreasuryReceivesMintPayments() public {
        _mint(USER);
        vm.prank(USER);
        vm.expectRevert(NalarCollection.OnlyTreasury.selector);
        collection.withdraw();
        vm.expectRevert(NalarCollection.OnlyTreasury.selector);
        collection.withdraw();
        assertEq(address(collection).balance, PRICE);
        vm.prank(TREASURY);
        collection.withdraw();
        assertEq(TREASURY.balance, PRICE);
        assertEq(address(collection).balance, 0);
    }

    function testWithdrawFailurePreservesFundsAndCanRetry() public {
        WithdrawReceiver treasury = new WithdrawReceiver();
        collection = new NalarCollection(PRICE, address(treasury));
        treasury.configure(collection, true);
        _mint(USER);
        vm.expectRevert(NalarCollection.WithdrawFailed.selector);
        treasury.withdraw();
        assertEq(address(collection).balance, PRICE);
        treasury.configure(collection, false);
        treasury.withdraw();
        assertEq(address(collection).balance, 0);
        assertEq(address(treasury).balance, PRICE);
        assertFalse(treasury.reentrySucceeded());
        assertEq(
            treasury.reentryResult(), abi.encodeWithSelector(ReentrancyGuard.ReentrancyGuardReentrantCall.selector)
        );
    }

    function _mint(address owner) internal {
        vm.prank(owner);
        collection.safeMint{value: PRICE}();
    }

    function _decodeDataURI(string memory uri, string memory prefix) internal pure returns (string memory) {
        bytes memory encoded = bytes(uri);
        uint256 prefixLength = bytes(prefix).length;
        assertEq(string(Bytes.slice(encoded, 0, prefixLength)), prefix);
        return string(Base64.decode(string(Bytes.slice(encoded, prefixLength))));
    }

    function _assertLogo(string memory svg) internal pure {
        assertTrue(vm.contains(svg, "<svg"));
        assertTrue(vm.contains(svg, "</svg>"));
        assertTrue(vm.contains(svg, ".cls-1{fill:#0b132b;}.cls-2{fill:#06f;}"));
        assertTrue(vm.contains(svg, '<rect class="cls-1" x="70.19" y="208.7" width="95.75" height="201.58"/>'));
        assertTrue(
            vm.contains(
                svg,
                '<path class="cls-1" d="M479.6,209.73V410.59a289.18,289.18,0,0,1-95.91-16.24q-12.29-4.31-24-9.66A291.05,291.05,0,0,1,239.57,283.24a.07.07,0,0,1,0-.06,191.77,191.77,0,0,0-10.9-17.37s0,0,0-.05A194.59,194.59,0,0,0,166.28,209a2.9,2.9,0,0,0-.34-.19V103.88q12.3,4.32,24.07,9.66A291,291,0,0,1,306,209c1.4,2,2.76,3.91,4.1,5.91a187.43,187.43,0,0,0,11,17.5s0,0,0,0a194.33,194.33,0,0,0,62.72,57V209.73Z"/>'
            )
        );
        assertTrue(vm.contains(svg, '<path class="cls-2" d="M479.6,103.88H383.85v33.38l62.37,62.37H479.6Z"/>'));
        assertFalse(vm.contains(svg, "<image"));
        assertFalse(vm.contains(svg, "href="));
    }
}
