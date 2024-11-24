// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.24;

library Pubkey {
    /**
     * EthAddress creates Ethereum address from a public key
     * @param pubkey the uncompressed secp256k1 public key
     */
    function EthAddress(
        bytes32[2] calldata pubkey
    ) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(pubkey)))));
    }

    /**
     * ConsAddress creates Cosmos address from a public key
     * @param pubkey the uncompressed secp256k1 public key
     */
    function ConsAddress(
        bytes32[2] calldata pubkey
    ) internal pure returns (address) {
        bytes1 prefix = uint256(pubkey[1]) & 1 == 0
            ? bytes1(0x02)
            : bytes1(0x03);
        bytes32 sum256 = sha256(bytes.concat(prefix, pubkey[0]));
        return address(ripemd160(abi.encodePacked(sum256)));
    }
}
