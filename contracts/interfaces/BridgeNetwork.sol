// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

interface IBridgeNetwork {
    event NewBitcoinBlock(uint128 indexed height);

    struct BlockHeader {
        bytes32 prevBlock;
        bytes32 merkleRoot;
        uint32 version;
        uint32 bits;
        uint32 nonce;
        uint32 timestmap;
    }

    struct HeaderRange {
        uint128 start;
        uint128 latest;
    }

    function bech32HRP() external view returns (string memory);

    function networkName() external view returns (string memory);

    function isAddrValid(string calldata addr) external view returns (bool);

    function newBitcoinBlock(BlockHeader calldata header) external;
}
