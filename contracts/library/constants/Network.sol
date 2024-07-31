// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// network config in bytes32 to save space
// 1byte pubKeyHashAddrID + 1byte scriptHashAddrID
// 1byte bech32HRPLen + 2-3bytes bech32HRP
// 1byte networkNameLen + 6-8bytes networkName

library Network {
    bytes32 internal constant Mainnet =
        0x0005026263076d61696e6e657400000000000000000000000000000000000000;

    bytes32 internal constant Testnet3 =
        0x6fc402746208746573746e657433000000000000000000000000000000000000;

    bytes32 internal constant Regtest =
        0x6fc4046263727407726567746573740000000000000000000000000000000000;

    bytes32 internal constant Signet =
        0x6fc4027462067369676e65740000000000000000000000000000000000000000;
}
