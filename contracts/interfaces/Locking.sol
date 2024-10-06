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

    event UpdateTokenThreshold(address token, uint256 amount);
    event UpdateTokenWeight(address token, uint64 weight);
    event UpdateTokenLimit(address token, uint256 limit);
    event Grant(uint256 amount);
    event OpenCliam();

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
    event DistributeReward(uint64 id, uint256 goat, uint256 gas);

    event ChangeValidatorOwner(address validator, address owner);

    function create(
        bytes32[2] calldata pubkey,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    ) external payable;

    function lock(
        address validator,
        Locking[] calldata values
    ) external payable;

    function unlock(
        address validator,
        address recipient,
        Locking[] calldata values
    ) external;

    function completeUnlock(
        uint64 id,
        address recipient,
        address token,
        uint256 amount
    ) external;

    function claim(address validator, address recipient) external;

    function distributeReward(
        uint64 id,
        address recipient,
        uint256 goat,
        uint256 gasReward
    ) external;

    function creationThreshold() external view returns (Locking[] memory);

    function grant(uint256 amount) external;

    function addToken(
        address token,
        uint64 weight,
        uint256 limit,
        uint256 thrs
    ) external;

    function setTokenWeight(address token, uint64 weight) external;

    function setTokenLimit(address token, uint256 limit) external;

    function setThreshold(address token, uint256 amount) external;

    function getAddressByPubkey(
        bytes32[2] calldata pubkey
    ) external pure returns (address, address);
}
