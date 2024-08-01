// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

interface ITaxPayee is IERC165 {
    function payTax() external payable;
}
