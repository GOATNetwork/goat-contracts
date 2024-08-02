// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PreDeployedAddresses} from "../library/constants/Predeployed.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IGoatFoundation} from "../interfaces/GoatFoundation.sol";
import {IBridge} from "../interfaces/Bridge.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

contract GoatFoundation is Ownable, IGoatFoundation {
    using SafeERC20 for IERC20;
    using Address for address payable;

    // It's for testing only
    constructor() Ownable(msg.sender) {}

    function transfer(
        address payable _to,
        uint256 _amount
    ) external override onlyOwner {
        _to.sendValue(_amount);
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
    receive() external payable {}

    function setDepositFee(uint16 _bp, uint64 _max) external onlyOwner {
        IBridge(PreDeployedAddresses.Bridge).setDepositFee(_bp, _max);
    }

    function setWithdrawalFee(uint16 _bp, uint64 _max) external onlyOwner {
        IBridge(PreDeployedAddresses.Bridge).setWithdrawalFee(_bp, _max);
    }

    function takeBridgeTax() external onlyOwner {
        uint256 tax = IBridge(PreDeployedAddresses.Bridge).takeTax();
        emit Revenue(PreDeployedAddresses.Bridge, tax);
    }

    function supportsInterface(bytes4 id) external view virtual returns (bool) {
        return
            id == type(IERC165).interfaceId ||
            id == type(IGoatFoundation).interfaceId;
    }
}
