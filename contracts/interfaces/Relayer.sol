// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRelayer {
    event AddedVoter(bytes20 indexed voter, bytes32 keyHash, uint16 thrs);

    event RemovedVoter(bytes20 indexed voter, uint16 thrs);

    event ChangedThreshold(uint256 threshold);

    function addVoter(bytes20 voter, bytes32 vtkey, uint16 thrs) external;

    function removeVoter(bytes20 voter, uint16 thrs) external;

    function setThreshold(uint16 thrs) external;
}
