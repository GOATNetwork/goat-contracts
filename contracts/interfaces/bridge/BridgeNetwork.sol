// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBridgeNetwork {
    function bech32HRP() external view returns (string memory);

    function networkName() external view returns (string memory);

    function isAddrValid(string calldata addr) external view returns (bool);
}
