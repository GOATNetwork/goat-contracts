// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Burner {
    constructor() payable {
        selfdestruct(payable(address(this)));
    }
}
