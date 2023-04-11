// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IUSDT is IERC20 {
    function mint(address to, uint256 amount) external;

    function decimals() external view returns (uint8);
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns(bool); 
    function transfer(
        address from,
        address to,
        uint256 _amount
    ) external;
}
