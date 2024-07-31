// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract Burner {
    constructor() payable {
        selfdestruct(payable(address(this)));
    }
}
