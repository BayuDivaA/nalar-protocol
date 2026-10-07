// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract NalarCollection is ERC721, ReentrancyGuard {
    uint256 public constant MAX_SUPPLY = 888;
    uint256 public immutable mintPrice;
    address public immutable treasury;
    uint256 public totalSupply;

    // Exact vector and colors from frontend/public/brand/n-light.svg.
    string private constant LOGO =
        '<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" width="560" height="560" viewBox="0 0 560 560"><defs><style>.cls-1{fill:#0b132b;}.cls-2{fill:#06f;}</style></defs><rect class="cls-1" x="70.19" y="208.7" width="95.75" height="201.58"/><path class="cls-1" d="M479.6,209.73V410.59a289.18,289.18,0,0,1-95.91-16.24q-12.29-4.31-24-9.66A291.05,291.05,0,0,1,239.57,283.24a.07.07,0,0,1,0-.06,191.77,191.77,0,0,0-10.9-17.37s0,0,0-.05A194.59,194.59,0,0,0,166.28,209a2.9,2.9,0,0,0-.34-.19V103.88q12.3,4.32,24.07,9.66A291,291,0,0,1,306,209c1.4,2,2.76,3.91,4.1,5.91a187.43,187.43,0,0,0,11,17.5s0,0,0,0a194.33,194.33,0,0,0,62.72,57V209.73Z"/><path class="cls-2" d="M479.6,103.88H383.85v33.38l62.37,62.37H479.6Z"/></svg>';

    error TestnetOnly();
    error InvalidTreasury();
    error WrongMintPrice();
    error SoldOut();
    error OnlyTreasury();
    error WithdrawFailed();

    constructor(uint256 mintPrice_, address treasury_) ERC721("Nalar Editions", "NALAR") {
        if (block.chainid != 97) revert TestnetOnly();
        if (treasury_ == address(0)) revert InvalidTreasury();
        mintPrice = mintPrice_;
        treasury = treasury_;
    }

    function getMintPrice() external view returns (uint256) {
        return mintPrice;
    }

    function safeMint() external payable nonReentrant {
        if (msg.value != mintPrice) revert WrongMintPrice();
        if (totalSupply >= MAX_SUPPLY) revert SoldOut();
        _safeMint(msg.sender, ++totalSupply);
    }

    function withdraw() external nonReentrant {
        if (msg.sender != treasury) revert OnlyTreasury();
        (bool success,) = payable(treasury).call{value: address(this).balance}("");
        if (!success) revert WithdrawFailed();
    }

    function previewImage() external pure returns (string memory) {
        return _image("888 EDITIONS");
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory serial = Strings.toString(tokenId);
        string memory json = string.concat(
            '{"name":"Nalar Editions #',
            serial,
            '","description":"NALAR educational NFT demo on BNB Testnet. 888 on-chain editions.","image":"',
            _image(string.concat("#", serial, " / 888")),
            '","attributes":[{"trait_type":"Edition","value":',
            serial,
            "}]}"
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _image(string memory label) private pure returns (string memory) {
        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 640" role="img" aria-label="Nalar Editions ',
            label,
            '"><rect width="560" height="640" fill="#f4f6ff"/>',
            LOGO,
            '<g fill="#0b132b" font-family="sans-serif" text-anchor="middle"><text x="280" y="494" font-size="28" font-weight="700">NALAR EDITIONS</text><text x="280" y="548" font-size="22">',
            label,
            "</text></g></svg>"
        );
        return string.concat("data:image/svg+xml;base64,", Base64.encode(bytes(svg)));
    }
}
