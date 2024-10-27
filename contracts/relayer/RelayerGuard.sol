// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.24;

import {Executor} from "../library/constants/Executor.sol";

contract RelayerGuard {
    error AccessDenied();
    error Forbidden();

    modifier OnlyRelayer() {
        require(msg.sender == Executor.Relayer, AccessDenied());
        _;
    }
}
