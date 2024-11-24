// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import {IGoatFoundation} from "../interfaces/GoatFoundation.sol";

contract GoatFoundation is Ownable, IERC165, IGoatFoundation {
    using SafeERC20 for IERC20;
    using Address for address payable;

    constructor(address owner) Ownable(owner) {}

    function transfer(
        address payable to,
        uint256 amount
    ) external override onlyOwner {
        to.sendValue(amount);
        emit Transfer(to, amount);
    }

    function transferERC20(
        address token,
        address to,
        uint256 amount
    ) external override onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    /**
     * invoke calls a contract
     * @param target a contract address but not the owner, otherwise revert
     * @param data contract call data
     * @param value contract call with value, owner can grant the value
     */
    function invoke(
        address payable target,
        bytes calldata data,
        uint256 value
    ) external payable onlyOwner returns (bytes memory) {
        require(target != owner(), "!owner"); // ensures reentrant is impossible
        return target.functionCallWithValue(data, value);
    }

    // donation
    receive() external payable {
        emit Donate(msg.sender, msg.value);
    }

    function supportsInterface(
        bytes4 id
    ) external view virtual override returns (bool) {
        return
            id == type(IERC165).interfaceId ||
            id == type(IGoatFoundation).interfaceId;
    }
}
