// SPDX-License-Identifier: Apache 2.0
pragma solidity =0.8.28;

contract Burner {
    constructor() payable {
        selfdestruct(payable(address(this)));
    }
}
