// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Executor} from "../constants/Executor.sol";
import {PreDeployedAddresses} from "../constants/Predeployed.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

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
