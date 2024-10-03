// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../library/codec/Pubkey.sol";

contract PubkeyTest {
    using Pubkey for bytes32[2];

    // Test the EthAddress function
    function testEthAddress(bytes32[2] calldata pubkey) external pure returns (address) {
        return pubkey.EthAddress();
    }

    // Test the ConsAddress function
    function testConsAddress(bytes32[2] calldata pubkey) external pure returns (address) {
        return pubkey.ConsAddress();
    }
}
