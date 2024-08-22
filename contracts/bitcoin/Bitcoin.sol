// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

import {BaseAccess} from "../library/utils/BaseAccess.sol";

import {IBitcoinBlock} from "../interfaces/bitcoin/Block.sol";
import {IBitcoinNetwork} from "../interfaces/bitcoin/Network.sol";

contract Bitcoin is BaseAccess, IBitcoinBlock, IBitcoinNetwork {
    bytes32 internal immutable network;

    uint256 public startHeight;
    uint256 public latestHeight;

    mapping(uint256 height => bytes32 blockHash) internal blocks;

    // precompiled, testing only
    constructor(uint256 _height, bytes32 _hash, bytes32 _network) {
        startHeight = _height;
        latestHeight = _height;
        blocks[_height] = _hash;
        network = _network;
    }

    // newBlockHash adds next finalized block hash
    // Note: the block hash uses little endian
    function newBlockHash(bytes32 _hash) external override OnlyRelayer {
        uint256 height = ++latestHeight;
        blocks[height] = _hash;
        emit NewBlockHash(height);
    }

    function blockHash(
        uint256 _height
    ) external view override returns (bytes32) {
        return blocks[_height];
    }

    function base58Prefix()
        public
        view
        returns (bytes1 pubKeyHashAddrID, bytes1 scriptHashAddrID)
    {
        pubKeyHashAddrID = network[0];
        scriptHashAddrID = network[1];
    }

    function bech32HRP() public view override returns (string memory) {
        uint8 hrpLen = uint8(network[2]);
        bytes memory hrp = new bytes(hrpLen);
        for (uint8 i = 0; i < hrpLen; i++) {
            hrp[i] = network[i + 3];
        }
        return string(hrp);
    }

    function networkName() public view override returns (string memory) {
        uint8 start = uint8(3) + uint8(network[2]);
        uint8 nameLen = uint8(network[start]);
        bytes memory name = new bytes(nameLen);
        for (uint8 i = 0; i < nameLen; i++) {
            name[i] = network[i + start + 1];
        }
        return string(name);
    }
}
