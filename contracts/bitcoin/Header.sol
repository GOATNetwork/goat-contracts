// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PreDeployedAddresses} from "../library/constants/Address.sol";
import {BitcoinAddress} from "../library/codec/Address.sol";
import {BaseAccess} from "../goat/BaseAccess.sol";

contract BitcoinHeader is BaseAccess {
    struct Header {
        bytes32 blockHash;
        bytes32 prevBlockHash;
        bytes32 merkleRoot;
        uint32 version;
        uint32 bits;
        uint32 nonce;
        uint32 timestmap; // bug in 2106y :)
    }

    // the the latest block height
    uint256 public front;

    // the initial block height, it should be inited in the genesis state
    uint256 public back;

    mapping(uint256 height => Header Header) public headers;

    function push(Header calldata header) external OnlyPosOwner {
        headers[++front] = header;
    }

    // todo(ericlee42): builtin spv for dapps
}
