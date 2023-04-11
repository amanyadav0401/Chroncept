//SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";

interface INFT is IERC1155Upgradeable, IERC2981 {
    function initialize(
        string memory _uri,
        address _admin,
        uint96 _defaultRoyalty,
        address _usdc
    ) external;

    function makeGlobalOffer(uint256 _tokenId, uint256 _offeredPrice) external;

    function makeSingleOffer(
        uint256 _tokenId,
        address _account,
        uint256 _amount,
        uint256 _offeredPrice
    ) external;

    function upgradeOffer(
        uint256 _tokenId,
        uint256 _globalOfferNo,
        uint256 _singleOfferNo,
        uint256 _newOfferedPrice,
        bool _isGlobal
    ) external;

    function transferShares(
        address _offerer,
        uint256 _tokenId,
        uint256 _globalOfferNo,
        uint256 _singleOfferNo,
        bool _isGlobal
    ) external;

    function lazyMintNFT(
        uint256 _tokenId,
        uint256 _amount,
        address _seller,
        address _buyer,
        string memory _uri
    ) external;

    function setRoyalty(
        uint256 _tokenId,
        address _royaltyKeeper,
        uint96 _royalty
    ) external;

    function addOperator(address _account, bool _status) external;

    function burn(
        address _account,
        uint256 _tokenId,
        uint256 _amount
    ) external;

    function setPlatformfee(uint256 _newFee) external;

    function supportsInterface(bytes4 interfaceId)
        external
        view
        override(IERC165Upgradeable, IERC165)
        returns (bool);
}
