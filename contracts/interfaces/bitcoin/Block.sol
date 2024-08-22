// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

interface IBitcoinBlock {
    event NewBlockHash(uint256 height);

    function startHeight() external view returns (uint256);

    function latestHeight() external view returns (uint256);

    function blockHash(uint256 _height) external view returns (bytes32);

    function newBlockHash(bytes32 _hash) external;
}
