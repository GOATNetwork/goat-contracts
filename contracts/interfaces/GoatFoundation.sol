// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGoatFoundation {
    event Transfer(address to, uint256 amount);
    event Revenue(address from, uint256 amount);

    function transfer(address payable, uint256) external;

    function transferERC20(
        address _token,
        address _to,
        uint256 _amount
    ) external;

    function setDepositFee(uint16 _bp, uint64 _max) external;

    function setWithdrawalFee(uint16 _bp, uint64 _max) external;

    function takeBridgeTax() external;
}
