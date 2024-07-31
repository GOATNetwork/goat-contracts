// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Goat is ERC20, Ownable {
    constructor() ERC20("GOAT", "GOAT") Ownable(msg.sender) {}
}
