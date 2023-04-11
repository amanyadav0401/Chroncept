//SPDX-License-Identifier:UNLICENSED

pragma solidity ^0.8.14;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./Interfaces/INFT.sol";

contract chronFactory is Initializable, OwnableUpgradeable {
    address NFTAddress;
    address admin;
    struct collection {
        uint256 collectionNo;
        mapping(uint256 => address) collectionAddress;
    }
    mapping(address => collection) public collections;
    event vaultcreated(uint256 _collectionNo, address _NFT, address _admin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "NO"); //Not Operator
        _;
    }

    function initialize(address _NFTAddress, address _admin)
        external
        initializer
    {
        require(_NFTAddress != address(0), "ZA"); //Zero Address
        require(_admin != address(0), "ZAA"); //Zero Admin Address
        __Ownable_init_unchained();
        NFTAddress = _NFTAddress;
        admin = _admin;
    }

    function createVault(
        string memory _uri,
        address _admin,
        uint96 _defaultRoyalty,
        address _usdc
    ) external onlyAdmin returns (address) {
        require(_usdc != address(0), "ZA"); //Zero address for USDC
        require(_admin != address(0), "ZAA"); //Zero address for admin
        collection storage col = collections[msg.sender];
        col.collectionNo++;
        bytes32 salt = keccak256(
            abi.encodePacked(col.collectionNo, _uri, _admin)
        );
        address _NFT = ClonesUpgradeable.cloneDeterministic(NFTAddress, salt);
        col.collectionAddress[col.collectionNo] = _NFT;
        INFT(_NFT).initialize(_uri, _admin, _defaultRoyalty, _usdc);
        emit vaultcreated(col.collectionNo, _NFT, _admin);
        return _NFT;
    }

    function predictVaultAddress(
        string memory _uri,
        address implementation,
        address _collectionNo,
        uint256 _admin
    ) internal view returns (address predicted) {
        bytes32 salt = keccak256(abi.encodePacked(_uri, _collectionNo, _admin));
        return
            ClonesUpgradeable.predictDeterministicAddress(
                implementation,
                salt,
                address(this)
            );
    }

    function updateNFTAddress(address _NFTAddress) external onlyAdmin {
        require(_NFTAddress != address(0), "ZA"); //Zero Address
        NFTAddress = _NFTAddress;
    }

    function viewVault(address _creator, uint256 _collectionNo)
        external
        view
        returns (address)
    {
        return collections[_creator].collectionAddress[_collectionNo];
    }

    function setAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "ZA"); //Zero Address
        admin = _newAdmin;
    }

    function _msgSender()
        internal
        view
        override(ContextUpgradeable)
        returns (address)
    {
        return msg.sender;
    }

    function _msgData()
        internal
        view
        override(ContextUpgradeable)
        returns (bytes calldata)
    {
        return msg.data;
    }
}
