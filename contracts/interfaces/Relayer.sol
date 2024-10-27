// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.24;

interface IRelayer {
    event AddedVoter(address indexed voter, bytes32 keyHash);

    event RemovedVoter(address indexed voter);

    function addVoter(address voter, bytes32 vtkey) external;

    function removeVoter(address voter) external;
}
