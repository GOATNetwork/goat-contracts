// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {RateLimiter} from "../library/utils/RateLimiter.sol";

contract RateLimiterCallee is RateLimiter {
    constructor(uint256 limit) RateLimiter(limit) {}

    function test1() public RateLimiting {}

    function test2(
        address caller,
        uint256 count
    ) public RateLimiting2(caller, count) {}
}

contract RateLimiterCaller {
    RateLimiterCallee immutable callee;

    constructor(RateLimiterCallee t) {
        callee = t;
    }

    function test1() public {
        callee.test1();
    }

    function test2(address caller, uint256 count) public {
        callee.test2(caller, count);
    }
}

contract RateLimiterTest is RateLimiter {
    constructor() RateLimiter(1) {}

    function pass1() public {
        RateLimiterCallee callee = new RateLimiterCallee(2);
        RateLimiterCaller caller1 = new RateLimiterCaller(callee);
        RateLimiterCaller caller2 = new RateLimiterCaller(callee);

        caller1.test1();
        caller2.test1();
    }

    function pass2() public {
        RateLimiterCallee callee = new RateLimiterCallee(3);
        RateLimiterCaller caller1 = new RateLimiterCaller(callee);
        RateLimiterCaller caller2 = new RateLimiterCaller(callee);

        caller1.test2(msg.sender, 1);
        caller2.test2(block.coinbase, 1);
    }

    function pass3() public {
        RateLimiterCallee callee = new RateLimiterCallee(2);
        RateLimiterCaller caller1 = new RateLimiterCaller(callee);
        RateLimiterCaller caller2 = new RateLimiterCaller(callee);

        caller1.test1();
        caller2.test2(block.coinbase, 1);
    }

    function fail1() public {
        RateLimiterCallee callee = new RateLimiterCallee(2);
        RateLimiterCaller caller1 = new RateLimiterCaller(callee);
        caller1.test1();
        caller1.test1();
    }

    function fail2() public {
        RateLimiterCallee callee = new RateLimiterCallee(2);
        RateLimiterCaller caller1 = new RateLimiterCaller(callee);
        RateLimiterCaller caller2 = new RateLimiterCaller(callee);
        RateLimiterCaller caller3 = new RateLimiterCaller(callee);

        caller1.test1();
        caller2.test1();
        caller3.test1();
    }

    function fail3() public {
        RateLimiterCallee callee = new RateLimiterCallee(2);
        RateLimiterCaller caller1 = new RateLimiterCaller(callee);
        RateLimiterCaller caller2 = new RateLimiterCaller(callee);

        caller1.test2(address(caller2), 1);
        caller2.test1();
    }

    function fail4() public {
        RateLimiterCallee callee = new RateLimiterCallee(2);
        RateLimiterCaller caller1 = new RateLimiterCaller(callee);
        caller1.test2(msg.sender, 3);
    }
}
