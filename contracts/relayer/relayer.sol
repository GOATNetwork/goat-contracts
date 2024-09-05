// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRelayer} from "../interfaces/Relayer.sol";

contract Relayer is Ownable, IRelayer {
    // It ensures efficiency for BLS signature aggregation and TSS operations
    uint16 public constant MAX_VOTER_COUNT = 256;

    uint16 public total;
    mapping(bytes32 vtkh => bool exists) public pubkeys;
    mapping(bytes20 voter => bool exists) public voters;

    constructor(address owner) Ownable(owner) {}

    /**
     * addVoter adds a new voter to relayer network
     * @param voter the voter address which derived from the tx key
     * @param vtkey the voter key hash which derived from the vote key
     * @param thrs the new threshold for relayer proposal
     *
     * the voter address = ripemd160(sha256(compressed secp256k1 public key))
     * the voter key hash = sha256(compressed bls12-381 public key in G2 group)
     *
     * we don't have heavy workload such as signature verification here
     * a new voter needs to provide online proof which includes the signature
     * to join the relayer network
     *
     * the adding will be activated after next relayer proposer election
     */
    function addVoter(
        bytes20 voter,
        bytes32 vtkey,
        uint16 thrs
    ) external onlyOwner {
        require(!pubkeys[vtkey], "duplicated key");
        require(!voters[voter], "duplicated voter");

        require(++total < MAX_VOTER_COUNT, "too many voters");
        require(thrs > 0 && thrs <= total, "invalid threshold");

        voters[voter] = true;
        pubkeys[vtkey] = true;
        emit AddedVoter(voter, vtkey, thrs);
    }

    /**
     * removeVoter removes a voter from relayer network
     * @param voter the voter address
     * @param thrs the new threshold for relayer proposal
     *
     * the removal will be activated after next relayer proposer election
     */
    function removeVoter(bytes20 voter, uint16 thrs) external onlyOwner {
        require(voters[voter], "voter not found");
        require(total > 1, "too few voters");
        // we don't delete the pubkey, it cant be reused next time
        voters[voter] = false;
        total--;
        require(thrs > 0 && thrs <= total, "invalid threshold");
        emit RemovedVoter(voter, thrs);
    }

    /**
     * setThreshold updates relayer proposal threshold
     * @param thrs the new thrshold for relayer proposal
     */
    function setThreshold(uint16 thrs) external onlyOwner {
        require(thrs > 0 && thrs <= total, "invalid threshold");
        emit ChangedThreshold(thrs);
    }
}
