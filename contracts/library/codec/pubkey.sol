// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library Pubkey {
    /**
     * ConsAddress creates Ethereum address from a public key
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
    ) internal pure returns (bytes20) {
        bytes1 prefix = uint256(pubkey[1]) & 1 == 0
            ? bytes1(0x02)
            : bytes1(0x03);
        return
            ripemd160(
                abi.encodePacked(sha256(bytes.concat(prefix, pubkey[0])))
            );
    }
}
