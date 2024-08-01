// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IGoatFoundation} from "../interfaces/GoatFoundation.sol";
import {ITaxPayee} from "../interfaces/TaxPayee.sol";
import {IBridge} from "../interfaces/Bridge.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

contract GoatFoundation is Ownable, IGoatFoundation {
    using SafeERC20 for IERC20;

    address public bridge;

    // It's for testing only
    constructor() Ownable(msg.sender) {
        bridge = msg.sender;
    }

    function transfer(
        address payable _to,
        uint256 _amount
    ) external override onlyOwner {
        (bool success, ) = _to.call{value: _amount}("");
        require(success);
        emit Transfer(_to, _amount);
    }

    function transferERC20(
        address _token,
        address _to,
        uint256 _amount
    ) external override onlyOwner {
        IERC20(_token).safeTransfer(_to, _amount);
    }

    // donation
    function recieve() external payable {}

    // testing only
    function setBridge(address _bridge) external onlyOwner {
        require(IERC165(_bridge).supportsInterface(type(IBridge).interfaceId));
        bridge = _bridge;
    }

    function setDepositFee(uint16 _bp, uint64 _max) external onlyOwner {
        IBridge(bridge).setDepositFee(_bp, _max);
    }

    function setWithdrawalFee(uint16 _bp, uint64 _max) external onlyOwner {
        IBridge(bridge).setWithdrawalFee(_bp, _max);
    }

    function takeBridgeTax() external onlyOwner {
        uint256 amount = IBridge(bridge).takeTax();
        emit Revenue(bridge, amount);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) external view virtual returns (bool) {
        return
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IGoatFoundation).interfaceId;
    }
}
