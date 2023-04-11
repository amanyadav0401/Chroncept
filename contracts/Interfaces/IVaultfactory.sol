//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.14;

interface IVaultfactory {
    function initialize(address _vault) external;

    function createVault(
        string memory _uri,
        address _admin,
        uint96 _defaultRoyalty,
        address _usdc
    ) external;

    function updateVault(address _vault) external;

    function viewVault(address _creator, uint256 _collectionNo)
        external
        view
        returns (address);
}
