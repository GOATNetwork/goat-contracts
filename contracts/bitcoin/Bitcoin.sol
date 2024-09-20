// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

import {BaseAccess} from "../library/utils/BaseAccess.sol";
import {IBitcoin} from "../interfaces/Bitcoin.sol";

contract Bitcoin is BaseAccess, IBitcoin {
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

    // newBlockHash adds next finalized block hash
    // Note: the block hash uses little endian
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
