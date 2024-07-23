// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PreDeployedAddresses} from "../library/constants/Address.sol";

contract BaseAccess {
    modifier OnlyPosOwner() {
        require(msg.sender == PreDeployedAddresses.PoSOwner, "!pos owner");
        _;
    }

    modifier OnlyDAOExecutor() {
        require(msg.sender == PreDeployedAddresses.GoatDAO, "!goat dao");
        _;
    }
}
