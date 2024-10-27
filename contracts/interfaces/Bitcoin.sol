// SPDX-License-Identifier: Apache 2.0

pragma solidity ^0.8.24;

interface IBitcoin {
    event NewBlockHash(uint256 height);

    function startHeight() external view returns (uint256);

    function latestHeight() external view returns (uint256);

    function blockHash(uint256 _height) external view returns (bytes32);

    function newBlockHash(bytes32 _hash) external;

    function networkName() external view returns (string memory);
}
