// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract LockingTokenWrapper is ERC20 {
    using SafeERC20 for IERC20Metadata;

    error InvalidValue();

    IERC20Metadata public immutable underlying;
    uint256 public immutable exchangeRate;

    constructor(
        IERC20Metadata token
    )
        ERC20(
            string.concat(token.name(), " ", "Standard Wrapper"),
            string.concat(token.symbol(), "SW")
        )
    {
        uint256 decimals = token.decimals();
        require(decimals < 18 && decimals > 0, "invalid decimals");
        underlying = token;
        exchangeRate = 10 ** (18 - decimals);
    }

    function deposit(uint256 value) public {
        require(value > 0, InvalidValue());
        address sender = _msgSender();
        underlying.safeTransferFrom(sender, address(this), value);
        _mint(sender, value * exchangeRate);
    }

    function withdraw(uint256 value) public {
        require(value > 0 && value % exchangeRate == 0, InvalidValue());
        address sender = _msgSender();
        _burn(sender, value);
        underlying.safeTransfer(sender, value / exchangeRate);
    }
}
