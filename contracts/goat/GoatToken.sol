// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
// import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

import {PreDeployedAddresses} from "../library/constants/Predeployed.sol";

contract GoatToken is ERC20, ERC20Burnable, ERC20Permit, ERC20Votes {
    constructor(address admin) ERC20("GOAT", "GOAT") ERC20Permit("GOAT") {
        _mint(admin, 975000000 * 1 ether);
        _mint(PreDeployedAddresses.Locking, 25000000 * 1 ether);
    }

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    function nonces(
        address owner
    ) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
