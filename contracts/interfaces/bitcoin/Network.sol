// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IBitcoinNetwork {
    function bech32HRP() external view returns (string memory);

    function networkName() external view returns (string memory);

    function base58Prefix()
        external
        view
        returns (bytes1 pubKeyHashAddrID, bytes1 scriptHashAddrID);
}
