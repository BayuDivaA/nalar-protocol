// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    ERC721
} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract TxSentryDemo is ERC721 {
    uint256 public nextTokenId;

    uint256 public constant MINT_PRICE = 0.02 ether;

    error WrongMintPrice();
    error DirectBNBTransferNotAllowed();

    constructor()
        ERC721("TxSentry Demo NFT", "TSNFT")
    {}

    /**
     * Normal / legitimate action.
     *
     * Expected user intent:
     * "Mint 1 NFT for 0.02 BNB."
     */
    function safeMint() external payable {
        if (msg.value != MINT_PRICE) {
            revert WrongMintPrice();
        }

        uint256 tokenId = nextTokenId++;

        _safeMint(msg.sender, tokenId);
    }

    /**
     * Deliberately dangerous action for
     * TxSentry security testing.
     *
     * This grants an operator permission to
     * manage all NFTs owned by msg.sender
     * in this collection.
     */
    function maliciousApproval(
        address operator
    ) external {
        _setApprovalForAll(
            msg.sender,
            operator,
            true
        );
    }

    function getMintPrice()
        external
        pure
        returns (uint256)
    {
        return MINT_PRICE;
    }
    

    receive() external payable {
        revert DirectBNBTransferNotAllowed();
    }
}   