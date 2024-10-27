// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.24;

/**
 * The rate limiter for consensus request
 */
contract RateLimiter {
    error TooManyRequest();
    error RequestTooFrequent();
    error RateLimitExceeded();

    uint256 public immutable REQUEST_PER_BLOCK;
    bool internal immutable CHECK_SENDER;

    constructor(uint256 count, bool checkSender) {
        REQUEST_PER_BLOCK = count;
        CHECK_SENDER = checkSender;
    }

    struct RateLimit {
        uint256 height;
        uint256 count;
        mapping(address caller => uint256 height) callers;
    }

    RateLimit internal rateLimit;

    modifier RateLimiting() {
        _checkLimiting(msg.sender, 1);
        _;
    }

    modifier RateLimiting2(address target, uint256 count) {
        _checkLimiting(target, count);
        _;
    }

    function _checkLimiting(address target, uint256 count) internal {
        if (CHECK_SENDER) {
            require(
                rateLimit.callers[target] != block.number,
                TooManyRequest()
            );
            rateLimit.callers[target] = block.number;
        }

        if (count == 0) {
            return;
        }

        if (block.number == rateLimit.height) {
            rateLimit.count += count;
        } else {
            rateLimit.height = block.number;
            rateLimit.count = count;
        }
        require(rateLimit.count <= REQUEST_PER_BLOCK, RateLimitExceeded());
    }
}
