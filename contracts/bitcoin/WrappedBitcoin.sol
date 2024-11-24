// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.24;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WrappedGoatBitcoin is ERC20Permit {
    event Deposit(address indexed dst, uint256 wad);
    event Withdrawal(address indexed src, uint256 wad);

    using Address for address payable;

    constructor() ERC20("Wrapped Goat Bitcoin", "WGBTC") ERC20Permit("WGBTC") {}

    receive() external payable {
        deposit();
    }

    function deposit() public payable {
        _mint(_msgSender(), msg.value);
        emit Deposit(_msgSender(), msg.value);
    }

    function withdraw(uint256 wad) public {
        _burn(_msgSender(), wad);
        payable(_msgSender()).sendValue(wad);
        emit Withdrawal(_msgSender(), wad);
    }
}
