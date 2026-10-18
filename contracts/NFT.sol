// where sellers can create NFT's they want to list 

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721URIStorage } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


contract NFTCollection is ERC721URIStorage, ReentrancyGuard {
    uint256 public nextTokenId;

    event NFTCreated(address indexed creator, uint256 indexed tokenId, string tokenURI);

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

    function createNFT(string memory URI) external nonReentrant returns (uint256 tokenId) {
        tokenId = nextTokenId++;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, URI);

        emit NFTCreated(msg.sender, tokenId, URI);
    }
}