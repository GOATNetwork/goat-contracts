// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILocking {
    struct Locking {
        address token;
        uint256 amount;
    }

    struct Token {
        bool exist; // placehold for existence check
        uint64 weight; // weight for validator power
        uint256 limit; // the max amount to lock, 0 represents no limits
        uint256 threshold; // the min amount to create a validator, 0 represents no required
    }

    event OpenCliam();

    event UpdateTokenThreshold(address token, uint256 amount);
    event UpdateTokenWeight(address token, uint64 weight);
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
    event CompleteUnlock(uint64 id, uint256 amount);

    event Claim(uint64 id, address validator, address recipient);
    event DistributeReward(uint64 id, address token, uint256 amount);

    event ChangeValidatorOwner(address validator, address owner);
}
