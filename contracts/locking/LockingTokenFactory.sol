// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.24;

import {LockingTokenWrapper} from "./LockingTokenWrapper.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract LockingTokenFactory {
    event Created(address indexed token, address wrapped);

    function wrap(address token) external {
        // we have token parameter here, so there is no conflict with the initHash
        LockingTokenWrapper wrapped = new LockingTokenWrapper{salt: bytes32(0)}(
            IERC20Metadata(token)
        );
        emit Created(token, address(wrapped));
    }
}
