// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TestToken is ERC20, Ownable {
    uint256 public num;

    constructor() ERC20("Test Stub", "TEST") Ownable(msg.sender) {}

    function mint(address _target, uint256 _amount) public onlyOwner {
        _mint(_target, _amount);
    }

    function setNumber(uint256 _n) public payable {
        num = _n;
    }
}
