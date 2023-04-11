// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

interface events{

    event buy(address seller, address buyer, uint256 amountBought);
    event royalty(uint96 royaltyAmount);
    event platFormFee(uint256 feeAmount);
    event newAdmin(address newAdmin);
}