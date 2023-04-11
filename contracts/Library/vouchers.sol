// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.14;

library voucher{
    struct shareSeller {
        address seller; //Seller Address
        address NFTAddress; //NFT Contract Address
        uint256 tokenId; // Unique tokenId
        uint256 shareSellAmount; // Amount of shares listed
        uint256 sharePrice; // Price of one share
        uint256 counter; // Unique counter for every voucher
        string tokenUri; // URI for the NFT
        bytes signature; // Signature of Seller's account
    }

    struct offer{
        uint256 offerNumber;
        address offerer;
        uint256 tokenId;
        uint256 offeredPrice;
        uint256 quantityAsked;
        address offeree;
        bytes signature;
    }

}