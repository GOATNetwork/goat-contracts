// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILocking {
    struct Locking {
        address token;
        uint256 amount;
    }

    struct Param {
        Locking[] creationThreshold;
        bool claim; // repreents the caliming is avaliable
    }

    struct Token {
        bool valid; // placehold for existing
        uint64 weight; // weight for validator power
        uint256 limit; // 0 -> no limits
    }

    event SetCreationThreshold(address token, uint256 amount);
    event RemoveCreationThreshold(address token);

    event UpdateTokenWeight(address token, uint64 power);
    event UpdateTokenLimit(address token, uint256 limit);

    event Create(address validator, address owner, bytes32[2] pubkey);

    event Lock(address validator, address token, uint256 amount);
    event Unlock(
        uint64 id,
        address validator,
        address recipient,
        address token,
        uint256 amount
    );
    event CompleteUnlock(uint64 id, address token, uint256 amount);

    event Claim(uint64 id, address validator, address recipient);
    event DistributeReward(uint64 id, address token, uint256 amount);

    event ChangeValidatorOwner(address validator, address owner);
}
