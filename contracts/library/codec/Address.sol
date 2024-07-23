// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library BitcoinAddress {
    uint8 public constant TypePubkeyHash = 0;
    uint8 public constant TypeScriptHash = 1;
    uint8 public constant TypeWitnessPubkeyHash = 2;
    uint8 public constant TypeWitnessScriptHash = 3;
    uint8 public constant TypeTaproot = 4;

    function isValid(bytes calldata _addr) external pure returns (bool) {
        if (_addr.length < 21) {
            return false;
        }

        uint8 typ = uint8(_addr[0]);
        if (
            typ == TypePubkeyHash ||
            typ == TypeScriptHash ||
            typ == TypeWitnessPubkeyHash
        ) {
            return _addr.length == 21;
        }

        if (typ == TypeWitnessScriptHash || typ == TypeTaproot) {
            return _addr.length == 33;
        }

        return false;
    }
}
