// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRelayer {
    event AddedVoter(bytes20 indexed voter, bytes32 keyHash);

    event RemovedVoter(bytes20 indexed voter);

    function addVoter(bytes20 voter, bytes32 vtkey) external;

    function removeVoter(bytes20 voter) external;
}
