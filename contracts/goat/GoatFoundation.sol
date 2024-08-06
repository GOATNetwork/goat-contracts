// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PreDeployedAddresses} from "../library/constants/Predeployed.sol";

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import {IGoatFoundation} from "../interfaces/GoatFoundation.sol";
import {IBridgeParam} from "../interfaces/BridgeParam.sol";

contract GoatFoundation is Ownable, IERC165, IGoatFoundation, IBridgeParam {
    using SafeERC20 for IERC20;
    using Address for address payable;

    // It's for testing only
    // the owner can be DAO or a Safe wallet
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
    receive() external payable {
        emit Donate(msg.sender, msg.value);
    }

    function setDepositTax(uint16 _bp, uint64 _max) external onlyOwner {
        IBridgeParam(PreDeployedAddresses.Bridge).setDepositTax(_bp, _max);
    }

    function setWithdrawalTax(uint16 _bp, uint64 _max) external onlyOwner {
        IBridgeParam(PreDeployedAddresses.Bridge).setWithdrawalTax(_bp, _max);
    }

    function setRateLimit(uint16 _sec) external onlyOwner {
        IBridgeParam(PreDeployedAddresses.Bridge).setRateLimit(_sec);
    }

    function supportsInterface(
        bytes4 id
    ) external view virtual override returns (bool) {
        return
            id == type(IERC165).interfaceId ||
            id == type(IBridgeParam).interfaceId ||
            id == type(IGoatFoundation).interfaceId;
    }
}
