// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.24;

import {RateLimiter} from "../library/utils/RateLimiter.sol";

contract RateLimiterCallee is RateLimiter {
    constructor(
        uint256 limit,
        bool checkSender
    ) RateLimiter(limit, checkSender) {}

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
    constructor() RateLimiter(0, false) {} // It's to recognize custom errors name in the tests

    function pass1() public {
        RateLimiterCallee callee = new RateLimiterCallee(2, true);
        RateLimiterCaller caller1 = new RateLimiterCaller(callee);
        RateLimiterCaller caller2 = new RateLimiterCaller(callee);

        caller1.test1();
        caller2.test1();
    }

    function pass2() public {
        RateLimiterCallee callee = new RateLimiterCallee(3, true);
        RateLimiterCaller caller1 = new RateLimiterCaller(callee);
        RateLimiterCaller caller2 = new RateLimiterCaller(callee);

        caller1.test2(msg.sender, 1);
        caller2.test2(block.coinbase, 1);
    }

    function pass3() public {
        RateLimiterCallee callee = new RateLimiterCallee(2, true);
        RateLimiterCaller caller1 = new RateLimiterCaller(callee);
        RateLimiterCaller caller2 = new RateLimiterCaller(callee);

        caller1.test1();
        caller2.test2(block.coinbase, 1);
    }

    function pass4() public {
        RateLimiterCallee callee = new RateLimiterCallee(2, false);
        RateLimiterCaller caller1 = new RateLimiterCaller(callee);

        caller1.test1();
        caller1.test1();
    }

    function pass5() public {
        RateLimiterCallee callee = new RateLimiterCallee(2, false);
        RateLimiterCaller caller1 = new RateLimiterCaller(callee);
        RateLimiterCaller caller2 = new RateLimiterCaller(callee);

        caller1.test1();
        caller2.test2(block.coinbase, 1);
    }

    function pass6() public {
        RateLimiterCallee callee = new RateLimiterCallee(2, true);
        RateLimiterCaller caller1 = new RateLimiterCaller(callee);
        RateLimiterCaller caller2 = new RateLimiterCaller(callee);
        RateLimiterCaller caller3 = new RateLimiterCaller(callee);

        caller1.test1();
        caller2.test2(msg.sender, 0);
        caller3.test2(block.coinbase, 1);
    }

    function pass7() public {
        RateLimiterCallee callee = new RateLimiterCallee(2, true);
        RateLimiterCaller caller1 = new RateLimiterCaller(callee);
        RateLimiterCaller caller2 = new RateLimiterCaller(callee);
        RateLimiterCaller caller3 = new RateLimiterCaller(callee);

        caller1.test1();
        caller2.test2(address(caller3), 1);
        caller3.test2(block.coinbase, 0);
    }

    function fail1() public {
        RateLimiterCallee callee = new RateLimiterCallee(2, true);
        RateLimiterCaller caller1 = new RateLimiterCaller(callee);
        caller1.test1();
        caller1.test1();
    }

    function fail2() public {
        RateLimiterCallee callee = new RateLimiterCallee(2, true);
        RateLimiterCaller caller1 = new RateLimiterCaller(callee);
        RateLimiterCaller caller2 = new RateLimiterCaller(callee);
        RateLimiterCaller caller3 = new RateLimiterCaller(callee);

        caller1.test1();
        caller2.test1();
        caller3.test1();
    }

    function fail3() public {
        RateLimiterCallee callee = new RateLimiterCallee(2, true);
        RateLimiterCaller caller1 = new RateLimiterCaller(callee);
        RateLimiterCaller caller2 = new RateLimiterCaller(callee);

        caller1.test2(address(caller2), 1);
        caller2.test1();
    }

    function fail4() public {
        RateLimiterCallee callee = new RateLimiterCallee(2, true);
        RateLimiterCaller caller1 = new RateLimiterCaller(callee);
        caller1.test2(msg.sender, 3);
    }
}
