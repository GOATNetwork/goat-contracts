// SPDX-License-Identifier: Business Source License 1.1

pragma solidity ^0.8.24;

interface IBitcoinBlock {
    error AccessDenied();

    event NewBlockHash(uint256 height);

    function startHeight() external view returns (uint256);

    function latestHeight() external view returns (uint256);

    function blockHash(uint256 _height) external view returns (bytes32);

    function newBlockHash(bytes32 _hash) external;
}
