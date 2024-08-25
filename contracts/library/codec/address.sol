// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Bitcoin address encoding rule
 * address type + address data
 * the type is an enum value which defined following constant values
 * the data is a raw pubkey hash or script hash
 * refer to https://github.com/GOATNetwork/goat-tests/blob/main/address/withdrawal.json for the details
 */

library BitcoinAddress {
    uint8 internal constant TypePubkeyHash = 0;
    uint8 internal constant TypeScriptHash = 1;
    uint8 internal constant TypeWitnessPubkeyHash = 2;
    uint8 internal constant TypeWitnessScriptHash = 3;
    uint8 internal constant TypeTaproot = 4;

    function isValidAddress(bytes calldata _addr) internal pure returns (bool) {
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
