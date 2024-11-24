// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.24;

import {RelayerGuard} from "../relayer/RelayerGuard.sol";

import {IBitcoin} from "../interfaces/Bitcoin.sol";

contract Bitcoin is RelayerGuard, IBitcoin {
    string public networkName;
    uint256 public startHeight;
    uint256 public latestHeight;

    mapping(uint256 height => bytes32 blockHash) internal blocks;

    // precompiled, testing only
    constructor(uint256 _height, bytes32 _hash, string memory _network) {
        startHeight = _height;
        latestHeight = _height;
        blocks[_height] = _hash;
        networkName = _network;
    }

    /**
     * newBlockHash adds a new finalized block hash
     * @param _hash block hash with little endian
     *
     * goat provides an L1 state oracle for third dapps on system level
     * they can use the block hash to do such as SPV(Simplified Payment Verification)
     */
    function newBlockHash(bytes32 _hash) external override OnlyRelayer {
        uint256 height = ++latestHeight;
        blocks[height] = _hash;
        emit NewBlockHash(height);
    }

    function blockHash(
        uint256 height
    ) external view override returns (bytes32) {
        return blocks[height];
    }
}
