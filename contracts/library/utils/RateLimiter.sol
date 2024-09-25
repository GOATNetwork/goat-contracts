// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract RateLimiter is Ownable {
    uint256 internal lastRequestBlock = 0;
    uint256 internal lastRequestCount = 0;

    uint256 public requestPerBlock = 16;

    event RequestPerBlockUpdated(uint256 throttle);

    constructor(address owner) Ownable(owner) {}

    modifier Limiting() {
        if (block.number == lastRequestBlock) {
            require(lastRequestCount < requestPerBlock, "rate limit exceeded");
            lastRequestCount++;
        } else {
            lastRequestBlock = block.number;
            lastRequestCount = 1;
        }
        _;
    }

    function setRequestPerBlock(uint256 _new) external onlyOwner {
        require(_new >= 8, "throttle too low");
        require(_new <= 100, "throttle too high");
        requestPerBlock = _new;
        emit RequestPerBlockUpdated(_new);
    }
}
