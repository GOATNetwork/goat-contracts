// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.24;

interface IGoatFoundation {
    event Transfer(address to, uint256 amount);
    event Donate(address from, uint256 amount);

    function transfer(address payable, uint256) external;

    function transferERC20(address token, address to, uint256 amount) external;

    function invoke(
        address payable target,
        bytes calldata data,
        uint256 value
    ) external payable returns (bytes memory);
}
