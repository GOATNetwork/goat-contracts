// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Executor} from "../constants/Executor.sol";

contract BaseAccess {
    error AccessDenied();
    error Forbidden();

    modifier OnlyRelayer() {
        if (msg.sender != Executor.Relayer) {
            revert AccessDenied();
        }
        _;
    }
}
