// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.14;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Library/vouchers.sol";
import "./Interfaces/events.sol";

contract ChronNFT is
    ERC1155URIStorageUpgradeable,
    ERC2981Upgradeable,
    EIP712Upgradeable,
    events,
    Ownable
{
    //Address for USDC token.
    address public usdc;
    //Address for admin
    address public admin;
    //Royalty Amount
    uint96 public royaltyAmount;
    //Address for Marketplace
    address marketPlace;
    //Platform Fee for the marketPlace
    uint256 public platformFee;

    //Struct for the mappings to store single and global offers offered amounts
    struct offer {
        mapping(uint256 => uint256) globalOffers;
        mapping(uint256 => uint256) singleOffers;
    }
    //Mapping for tracking the supply of every token ID
    mapping(uint256 => uint256) public tokenSupply;
    //Mapping for the storage of offered amounts of every Offer made against every users address
    mapping(address => offer) private offers;

    modifier onlyAdmin() {
        require(msg.sender == admin, "NA"); //Not Admin
        _;
    }

    /**
     * @dev Initializes the contract by passing `uri`, `admin`, `royaltyAmount`, `usdc`, `marketPlace` for the NFT contract
     * @param _uri is the base uri required to initialize the ERC1155 contract
     * @param _admin is the address for the Admin of the contract
     * @param _royaltyAmount is the amount set for royalty of the token IDs
     * @param _usdc is the Address for the USDC contract used as base currency
     * @param _marketPlace is address for the marketPlace for thr NFT contract
     */
    function initialize(
        string memory _uri,
        address _admin,
        uint96 _royaltyAmount,
        address _usdc,
        address _marketPlace
    ) external initializer {
        require(_admin != address(0), "ZAA"); //Zero Address for Admin
        require(_usdc != address(0), "ZAU"); //Zero Address for USDC
        require(_marketPlace != address(0), "ZAM"); //Zero Address for Marketplace
        __ERC1155_init_unchained(_uri);
        __ERC2981_init_unchained();
        __EIP712_init("ChronNFT", "1");
        royaltyAmount = _royaltyAmount;
        admin = _admin;
        usdc = _usdc;
        marketPlace = _marketPlace;
    }

    /**
     * @notice Returns a hash of the given offer, prepared using EIP712 typed data hashing rules.
     * @param offerDetails is a offer to hash.
     */
    function hashOfferDetails(voucher.offer memory offerDetails)
        internal
        view
        returns (bytes32)
    {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256(
                            "offer(uint256 offerNumber,address offerer,uint256 tokenId,uint256 offeredPrice,uint256 quantityAsked,address offeree)"
                        ),
                        offerDetails.offerNumber,
                        offerDetails.offerer,
                        offerDetails.tokenId,
                        offerDetails.offeredPrice,
                        offerDetails.quantityAsked,
                        offerDetails.offeree
                    )
                )
            );
    }

    /**
     * @notice Verifies the signature for a given offer, returning the address of the signer.
     * @dev Will revert if the signature is invalid.
     * @param offerDetails is a offer describing the NFT to be sold
     */
    function verifyOfferDetails(voucher.offer memory offerDetails)
        internal
        view
        returns (address)
    {
        bytes32 digest = hashOfferDetails(offerDetails);
        return ECDSAUpgradeable.recover(digest, offerDetails.signature);
    }

    /**
     * @dev `offerdetails` and will be used at the time of making offer
     * @param offerDetails is a offer describing the NFT to be sold
     * @param _isGlobal is a boolean value indicating whether the offer is global or single
     */
    function makeOffer(voucher.offer memory offerDetails, bool _isGlobal)
        external
    {
        require(tokenSupply[offerDetails.tokenId] > 0, "IT"); //Invalid Token

        require(offerDetails.offerer == verifyOfferDetails(offerDetails), "IO"); //Invalid Offerer

        if (_isGlobal) {
            IERC20(usdc).transferFrom(
                msg.sender,
                address(this),
                offerDetails.offeredPrice
            );
            offers[msg.sender].globalOffers[
                offerDetails.offerNumber
            ] = offerDetails.offeredPrice;
        } else {
            require(
                balanceOf(offerDetails.offeree, offerDetails.tokenId) >=
                    offerDetails.quantityAsked,
                "INB"
            ); // Insufficeient NFT balance
            IERC20(usdc).transferFrom(
                msg.sender,
                address(this),
                offerDetails.offeredPrice
            );
            offers[msg.sender].singleOffers[
                offerDetails.offerNumber
            ] = offerDetails.offeredPrice;
        }
    }

    /**
     * @dev `tokenId`, `offerNumber`,  `_newOfferedPrice` and  `_isGlobal` will be used at the time of upgrading the offer
     * @param _tokenId is the unique token ID for the NFT for which the offer is to be upgraded
     * @param _offerNumber is the offer number for the offer to be upgraded
     * @param _newOfferedPrice is the new offered amount from the offerer
     * @param _isGlobal is a boolean value indicating whether the offer is global or single
     */
    function upgradeOffer(
        uint256 _tokenId,
        uint256 _offerNumber,
        uint256 _newOfferedPrice,
        bool _isGlobal
    ) external {
        require(tokenSupply[_tokenId] > 0, "IT"); //Invalid Token
        if (_isGlobal) {
            require(offers[msg.sender].globalOffers[_offerNumber] != 0, "ION"); //Invalid Offer No.
            uint256 previousPrice = offers[msg.sender].globalOffers[
                _offerNumber
            ];
            require(_newOfferedPrice > previousPrice, "IOP"); //Invalid Offered Price
            offers[msg.sender].globalOffers[_offerNumber] = _newOfferedPrice;
            IERC20(usdc).transferFrom(
                msg.sender,
                address(this),
                (_newOfferedPrice - previousPrice)
            );
        } else {
            require(offers[msg.sender].singleOffers[_offerNumber] != 0, "ION"); //Invalid Offer No.
            uint256 previousPrice = offers[msg.sender].singleOffers[
                _offerNumber
            ];
            require(_newOfferedPrice > previousPrice, "IOP"); //Invalid Offered Price
            offers[msg.sender].singleOffers[_offerNumber] = _newOfferedPrice;
            IERC20(usdc).transferFrom(
                msg.sender,
                address(this),
                (_newOfferedPrice - previousPrice)
            );
        }
    }

    /**
     * @notice this function will be used to transfer shares at the time of accepting offer
     * @param offerDetails is a offer describing the NFT to be sold
     * @param _isGlobal is a boolean value indicating whether the offer is global or single
     */
    function transferShares(voucher.offer memory offerDetails, bool _isGlobal)
        external
    {
        require(offerDetails.offerer == verifyOfferDetails(offerDetails), "IO"); //Invalid Offerer

        uint256 transferAmount;

        if (_isGlobal) {
            transferAmount = balanceOf(msg.sender, offerDetails.tokenId);
        } else {
            require(offerDetails.offeree == msg.sender, "OI"); //Offeree Invalid
            require(
                balanceOf(msg.sender, offerDetails.tokenId) >=
                    offerDetails.quantityAsked,
                "INB"
            ); // Insufficeient NFT balance
            transferAmount = offerDetails.quantityAsked;
        }
        uint256 fee = (offerDetails.offeredPrice * platformFee) / 10000;
        IERC20(usdc).transfer(admin, fee);
        IERC20(usdc).transfer(
            offerDetails.offeree,
            (offerDetails.offeredPrice - fee)
        );
        _safeTransferFrom(
            msg.sender,
            offerDetails.offerer,
            offerDetails.tokenId,
            transferAmount,
            ""
        );
    }

    /**
     * @notice This function will be used to refund the locked funds if the offer is not fullfilled or rejected
     * @param _tokenId is the unique token ID for the NFT
     * @param _offerNumber is the offer number for the offer to be upgraded
     * @param _isGlobal is a boolean value indicating whether the offer is global or single
     */
    function refundFunds(
        uint256 _tokenId,
        uint256 _offerNumber,
        bool _isGlobal
    ) external {
        require(tokenSupply[_tokenId] > 0, "IT"); //Invalid Token
        if (_isGlobal) {
            require(offers[msg.sender].globalOffers[_offerNumber] != 0, "ION"); //Invalid Offer No.
            require(offers[msg.sender].globalOffers[_offerNumber] > 0, "AR"); //Already Refunded
            uint256 paidPrice = offers[msg.sender].globalOffers[_offerNumber];
            uint256 acquiredSharesprice = balanceOf(msg.sender, _tokenId) *
                (paidPrice / tokenSupply[_tokenId]);
            uint256 refundPrice = paidPrice - acquiredSharesprice;
            offers[msg.sender].globalOffers[_offerNumber] = 0;
            IERC20(usdc).transfer(msg.sender, refundPrice);
        } else {
            require(offers[msg.sender].singleOffers[_offerNumber] != 0, "ION"); //Invalid Offer No.
            require(offers[msg.sender].singleOffers[_offerNumber] > 0, "AR"); //Already Refunded
            uint256 refundPrice = offers[msg.sender].singleOffers[_offerNumber];
            offers[msg.sender].singleOffers[_offerNumber] = 0;
            IERC20(usdc).transfer(msg.sender, refundPrice);
        }
    }

    /**
     * @notice This function will be used to redeem the NFT shares
     * @param _tokenId is the unique token ID for the NFT
     */
    function redeem(uint256 _tokenId) external {
        require(tokenSupply[_tokenId] > 0, "IT"); //Invalid Token
        require(balanceOf(msg.sender, _tokenId) == tokenSupply[_tokenId], "NE"); //Not Eligible
        _safeTransferFrom(
            msg.sender,
            admin,
            _tokenId,
            balanceOf(msg.sender, _tokenId),
            ""
        );
    }

    /**
     * @notice This function will be used to mint the NFT as per the details
     * @param _tokenId is the unique token ID for the NFT
     * @param _amount is the amount of shares to be minted
     * @param _seller address of the seller of NFT shares
     * @param _buyer address of the buyer of the NFT shares
     * @param _uri URI for the token to be minted
     */
    function lazyMintNFT(
        uint256 _tokenId,
        uint256 _amount,
        address _seller,
        address _buyer,
        string memory _uri
    ) external {
        require(msg.sender == marketPlace || msg.sender == admin, "IC"); //Invalid Caller
        _mint(_seller, _tokenId, _amount, "");
        _setURI(_tokenId, _uri);
        _setTokenRoyalty(_tokenId, admin, royaltyAmount);
        tokenSupply[_tokenId] += _amount;
        _safeTransferFrom(_seller, _buyer, _tokenId, _amount, "");
    }

    /**
     * @dev `royalty` will be used to update the royalty amount
     * @param _royalty is the royalty amount to be updated
     */
    function setRoyalty(uint96 _royalty) external onlyAdmin {
        royaltyAmount = _royalty;
        emit events.royalty(royaltyAmount);
    }

    /**
     * @dev `newAdmin` will be used to update the admin for the contract
     * @param _newAdmin is the address of the new admin for the contract
     */
    function setAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "ZA"); //Zero Address
        admin = _newAdmin;
        emit events.newAdmin(_newAdmin);
    }

    /**
     * @dev `newFee` will be used to update the platformfee amount of marketplace
     * @param _newFee the platform fee amount to be updated
     */
    function setPlatformfee(uint256 _newFee) external {
        require(msg.sender == marketPlace, "IC"); //Invalid Caller
        platformFee = _newFee;
        emit platFormFee(_newFee);
    }

    /**
     * @notice This function will be used to burn the specific share amount for a specific token ID
     * @param _account is the address of the account thr shares to be burned from
     * @param _tokenId is the unique token ID for the NFT
     * @param _amount is the amount of shares to be burned
     */
    function burn(
        address _account,
        uint256 _tokenId,
        uint256 _amount
    ) external onlyAdmin {
        require(tokenSupply[_tokenId] > 0, "IT"); //Invalid Token
        _burn(_account, _tokenId, _amount);
    }

    /**
     * @notice This is a view function used to view the URI for a specific token ID
     * @param tokenId is the unique token ID for the NFT
     */
    function uri(uint256 tokenId)
        public
        view
        override(ERC1155URIStorageUpgradeable)
        returns (string memory)
    {
        // require(tokenSupply[tokenId] > 0, "IT"); //Invalid Token
        return super.uri(tokenId);
    }

    function _msgSender()
        internal
        view
        override(Context, ContextUpgradeable)
        returns (address)
    {
        return msg.sender;
    }

    function _msgData()
        internal
        view
        override(Context, ContextUpgradeable)
        returns (bytes calldata)
    {
        return msg.data;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155Upgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
