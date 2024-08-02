// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Goat is ERC20Permit, ERC20Burnable, Ownable {
    constructor()
        ERC20("GOAT", "GOAT")
        Ownable(msg.sender)
        ERC20Permit("GOAT")
    {}
}
