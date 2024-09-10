// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILocking {
    struct Delegation {
        address token;
        uint256 amount;
    }

    struct Validator {
        address owner;
        uint16 commission;
    }

    struct Delegator {
        address validator;
        mapping(address token => uint256 amount) delegating;
    }

    struct Param {
        Delegation[] minSelfDelegation;
    }

    event SetMinSelfDelegation(address token, uint256 amount);
    event RemoveMinSelfDelegation(address token);
    event SetDelegationToken(address token, bool yes);

    event Create(bytes32[2] pubkey, uint16 commission);

    event Delegate(
        address validator,
        address delegator,
        address token,
        uint256 amount
    );

    event Undelegate(
        uint64 index,
        address delegator,
        address token,
        uint256 amount
    );

    event CompleteUndelegation(
        uint64 index,
        address delegator,
        address token,
        uint256 amount
    );

    event Claim(uint64 index, address delegator);

    event DistributeReward(
        uint64 index,
        address delegator,
        address token,
        uint256 amount
    );
}
