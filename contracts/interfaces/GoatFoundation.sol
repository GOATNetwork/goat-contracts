// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

interface IGoatFoundation {
    event Transfer(address to, uint256 amount);
    event Revenue(address from, uint256 amount);

    function transfer(address payable, uint256) external;

    function transferERC20(address token, address to, uint256 amount) external;

    function setDepositTax(uint16 bp, uint64 max) external;

    function setWithdrawalTax(uint16 bp, uint64 max) external;

    function takeBridgeTax() external;
}
