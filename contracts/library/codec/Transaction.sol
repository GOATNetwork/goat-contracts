// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PreCompiledAddresses} from "../constants/Address.sol";

library BitcoinNoWitnessTx {
    struct Input {
        bytes32 prevHash;
        uint32 index;
        uint32 sequence;
        bytes signatureScript;
    }

    struct Output {
        uint64 value;
        bytes pkScript;
    }

    // transaction without witness
    struct Tx {
        uint32 version;
        uint32 lockTime;
        Input[] intputs;
        Output[] outputs;
    }

    function decode(bytes calldata raw) external view returns (Tx memory) {
        (bool success, bytes memory data) = PreCompiledAddresses
            .BitcoinTxDecoderV0
            .staticcall(raw);

        if (success && data.length > 0) {
            Tx memory res = abi.decode(data, (Tx));
            return res;
        }

        revert("invalid btc tx");
    }
}
