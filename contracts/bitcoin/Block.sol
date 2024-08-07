// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

import {Executor} from "../library/constants/Executor.sol";
import {IBitcoinBlock} from "../interfaces/bitcoin/Block.sol";

contract BitcoinBlock is IBitcoinBlock {
    modifier OnlyRelayer() {
        if (msg.sender != Executor.Relayer) {
            revert AccessDenied();
        }
        _;
    }

    uint256 internal start;
    uint256 internal latest;

    mapping(uint256 height => bytes32 blockHash) internal blocks;

    // precompiled, testing only
    constructor(uint256 _height, bytes32 _hash) {
        start = _height;
        latest = _height;
        blocks[_height] = _hash;
    }

    // newBlockHash adds next finalized block hash
    // Note: the block hash uses little endian
    function newBlockHash(bytes32 _hash) external override OnlyRelayer {
        uint256 height = ++latest;
        blocks[height] = _hash;
        emit NewBlockHash(height);
    }

    function startHeight() external view override returns (uint256) {
        return start;
    }

    function latestHeight() external view override returns (uint256) {
        return latest;
    }

    function blockHash(
        uint256 _height
    ) external view override returns (bytes32) {
        return blocks[_height];
    }
}
