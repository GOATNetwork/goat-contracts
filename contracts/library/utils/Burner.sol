// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

contract Burner {
    constructor() payable {
        selfdestruct(payable(address(this)));
    }
}
