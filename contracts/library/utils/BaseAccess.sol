// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Executor} from "../constants/Executor.sol";
import {PreDeployedAddresses} from "../constants/Predeployed.sol";

contract BaseAccess {
    error AccessDenied();
    error Forbidden();

    modifier OnlyRelayer() {
        if (msg.sender != Executor.Relayer) {
            revert AccessDenied();
        }
        _;
    }

    modifier OnlyGoatFoundation() {
        if (msg.sender != PreDeployedAddresses.GoatFoundation) {
            revert AccessDenied();
        }
        _;
    }
}
