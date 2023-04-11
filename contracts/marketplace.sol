//SPDX-License-Identifier:MIT
pragma solidity ^0.8.14;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Interfaces/INFT.sol";
import "./Library/vouchers.sol";
import "./Interfaces/events.sol";

contract Marketplace is EIP712Upgradeable, events, Ownable {
    // Admin address of the contract
    address public admin;
    // Platform fee amount
    uint256 public platformFee;
    // Address for the NFT contract
    address NFTContract;
    // Address for USDT contract
    address usdt;
    // Address for the USDC contract
    address usdc;
    // Mapping for used counter numbers
    mapping(uint256 => bool) public usedCounters;
    // Mapping of the counter to the amount left in voucher
    mapping(uint256 => uint256) public amountLeft;
    // Mapping of white labled currencies
    mapping(address => bool) private allowedCurrencies;
    modifier onlyAdmin() {
        require(msg.sender == admin, "NA"); //Not Admin
        _;
    }

    /**
     * @dev Initializes the contract by setting a `admin`, `NFT`, and `platformfee` for the marketplace
     * @param _admin is set as the admin of the marketplace
     * @param _NFT is set as the NFT contract of thr marketplace
     * @param _platformFee is set as the platformFee for the marketplace
     */
    function initialize(
        address _admin,
        address _NFT,
        uint256 _platformFee,
        address _usdc,
        address _usdt
    ) external initializer {
        require(_admin != address(0), "ZAA"); //Zero Address for Admin
        require(_NFT != address(0), "ZAN"); //Zero Address for NFT contract
        __EIP712_init("Chroncept_MarketItem", "1");
        admin = _admin;
        NFTContract = _NFT;
        platformFee = _platformFee;
        usdt = _usdt;
        usdc = _usdc;
        allowedCurrencies[usdc] = true;
        allowedCurrencies[usdt] = true;
        INFT(NFTContract).setPlatformfee(_platformFee);
    }

    /**
     * @notice Returns a hash of the given shareSeller, prepared using EIP712 typed data hashing rules.
     * @param seller is a shareSeller to hash.
     */
    function hashShareSeller(voucher.shareSeller memory seller)
        internal
        view
        returns (bytes32)
    {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256(
                            "shareSeller(address seller,address NFTAddress,uint256 tokenId,uint256 shareSellAmount,uint256 sharePrice,uint256 counter,string tokenUri)"
                        ),
                        seller.seller,
                        seller.NFTAddress,
                        seller.tokenId,
                        seller.shareSellAmount,
                        seller.sharePrice,
                        seller.counter,
                        keccak256(bytes(seller.tokenUri))
                    )
                )
            );
    }

    /**
     * @notice Verifies the signature for a given shareSeller, returning the address of the signer.
     * @dev Will revert if the signature is invalid. Does not verify that the signer is owner of the NFT.
     * @param seller is a shareSeller describing the NFT to be sold
     */
    function verifyShareSeller(voucher.shareSeller memory seller)
        internal
        view
        returns (address)
    {
        bytes32 digest = hashShareSeller(seller);
        return ECDSAUpgradeable.recover(digest, seller.signature);
    }

    /**
     * @dev `seller` will be used in case of buying in both primary and secondary buy
     * @param seller is a shareSeller describing the NFT to be be sold
     * @param amountToBuy is amount on shares to be baought
     * @param isPrimary is a bool to indicate whether the buy is primary or secondary
     * @param currency is the address of the currency to be used
     */
    function buyShare(
        voucher.shareSeller memory seller,
        uint256 amountToBuy,
        bool isPrimary,
        address currency
    ) external payable {
        address sellerAddress = verifyShareSeller(seller);
        require(seller.seller == sellerAddress, "IS"); //Invalid Seller
        setCounter(seller, amountToBuy);

        if (isPrimary) {
            require(sellerAddress == admin, "NA"); //Not Admin
            uint256 amountToPay = seller.sharePrice * amountToBuy;

            uint256 finalFeeAmount = (platformFee * amountToPay) / 10000;

            if (currency == address(1)) {
                require(msg.value == amountToPay, "IA");
                //  uint256 ETHAmount = (msg.value - finalFeeAmount);

                (bool sentAmount, ) = payable(seller.seller).call{
                    value: (msg.value - finalFeeAmount)
                }("");
                require(sentAmount, "ATF"); //Amount Transfer Failed
                (bool sentFee, ) = payable(admin).call{value: finalFeeAmount}(
                    ""
                );
                require(sentFee, "FTF"); //Fee Transfer Failed
            } else {
                require(allowedCurrencies[currency], "IC"); //Invalid Currency
                IERC20(currency).transferFrom(
                    msg.sender,
                    admin,
                    finalFeeAmount
                );

                IERC20(currency).transferFrom(
                    msg.sender,
                    seller.seller,
                    (amountToPay - finalFeeAmount)
                );
            }
            INFT(seller.NFTAddress).lazyMintNFT(
                seller.tokenId,
                amountToBuy,
                seller.seller,
                msg.sender,
                seller.tokenUri
            );
            emit events.buy(seller.seller, msg.sender, amountToBuy);
        } else {
            require(
                INFT(seller.NFTAddress).balanceOf(
                    seller.seller,
                    seller.tokenId
                ) >= amountToBuy,
                "ISB"
            ); //Insufficient Share Balance
            uint256 amountToPay = seller.sharePrice * amountToBuy;

            (address reciever, uint256 royaltyAmount) = INFT(seller.NFTAddress)
                .royaltyInfo(seller.tokenId, amountToPay);

            uint256 finalFeeAmount = (platformFee * amountToPay) / 10000;

            if (currency == address(1)) {
                uint256 ETHAmount = amountToPay -
                    (finalFeeAmount + royaltyAmount);
                (bool sentAmount, ) = payable(seller.seller).call{
                    value: ETHAmount
                }("");
                require(sentAmount == true, "ATF"); //Amount Transfer Failed
                (bool sentFee, ) = payable(admin).call{value: finalFeeAmount}(
                    ""
                );
                require(sentFee == true, "FTF"); //Fee Transfer Failed
                (bool sentRoyalty, ) = payable(reciever).call{
                    value: royaltyAmount
                }("");
                require(sentRoyalty == true, "RTF"); //Royalty Transfer Failed
            } else {
                require(allowedCurrencies[currency], "IC"); //Invalid Currency
                IERC20(currency).transferFrom(
                    msg.sender,
                    admin,
                    finalFeeAmount
                );

                IERC20(currency).transferFrom(
                    msg.sender,
                    reciever,
                    royaltyAmount
                );

                IERC20(currency).transferFrom(
                    msg.sender,
                    seller.seller,
                    (amountToPay - (royaltyAmount + finalFeeAmount))
                );
            }

            IERC1155Upgradeable(seller.NFTAddress).safeTransferFrom(
                seller.seller,
                msg.sender,
                seller.tokenId,
                amountToBuy,
                ""
            );
            emit events.buy(seller.seller, msg.sender, amountToBuy);
        }
    }

    /**
     * @notice Function to set new platform fee
     * @param _newFee is the new marketplace fee
     */
    function setPlatformfee(uint256 _newFee) external onlyAdmin {
        platformFee = _newFee;
        INFT(NFTContract).setPlatformfee(_newFee);
        emit platFormFee(_newFee);
    }

    /**
     * @notice Function to set new Admin for the contract
     * @param _newAdmin is the address for the new admin of the contact
     */
    function setAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "ZA"); //Zero Address
        admin = _newAdmin;
        emit events.newAdmin(_newAdmin);
    }

    /**
     * @notice This is the internal function used to set the counter for the seller
     * @param seller is a shareSeller describing the NFT to be sold
     * @param amountToBuy is amount of shares of NFT to be bought
     */
    function setCounter(voucher.shareSeller memory seller, uint256 amountToBuy)
        internal
    {
        //Counter used
        require(!usedCounters[seller.counter], "CU");

        uint256 leftCounter = amountLeft[seller.counter];

        if (leftCounter == 0) {
            leftCounter = seller.shareSellAmount - amountToBuy;
        } else {
            leftCounter = leftCounter - amountToBuy;
        }
        require(leftCounter >= 0, "ALZ"); //Amount left less than zero

        amountLeft[seller.counter] = leftCounter;
        if (leftCounter == 0) usedCounters[seller.counter] = true;
    }
}
