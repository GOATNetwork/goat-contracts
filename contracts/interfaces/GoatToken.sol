// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IGoatToken is IERC20 {
    function mint(address to, uint256 amount) external;
}
