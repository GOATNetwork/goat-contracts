// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TestToken is ERC20, Ownable {
    uint256 public num;

    uint8 internal _decimal;

    constructor() ERC20("Test Stub", "TEST") Ownable(msg.sender) {
        _decimal = 18;
        _mint(msg.sender, 1 gwei * 1 ether);
    }

    function mint(address _target, uint256 _amount) public onlyOwner {
        _mint(_target, _amount);
    }

    function setNumber(uint256 _n) public payable {
        num = _n;
    }

    function setDecimal(uint8 d) public onlyOwner {
        _decimal = d;
    }

    function decimals() public view override returns (uint8) {
        return _decimal;
    }
}
