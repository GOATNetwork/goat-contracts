// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRelayer} from "../interfaces/Relayer.sol";

contract Relayer is Ownable, IRelayer {
    // It ensures efficiency for BLS signature aggregation and TSS operations
    uint256 public constant MAX_VOTER_COUNT = 256;

    uint256 public total;
    mapping(bytes32 vtkh => bool exists) public pubkeys;
    mapping(address voter => bool exists) public voters;
    mapping(address voter => bool deleted) public deletes;

    constructor(address owner) Ownable(owner) {}

    /**
     * addVoter adds a new voter to relayer network
     * @param voter the address which derived from the tx key
     * @param vtkey the hash which derived from the vote key
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
    function addVoter(address voter, bytes32 vtkey) external onlyOwner {
        require(!pubkeys[vtkey], "duplicated key");
        require(!voters[voter], "duplicated voter");
        require(!deletes[voter], "deleted voter");
        require(++total < MAX_VOTER_COUNT, "too many voters");

        voters[voter] = true;
        pubkeys[vtkey] = true;
        emit AddedVoter(voter, vtkey);
    }

    /**
     * removeVoter removes a voter from relayer network
     * @param voter the voter address
     *
     * the removal will be activated after next relayer proposer election
     */
    function removeVoter(address voter) external onlyOwner {
        require(voters[voter], "voter not found");
        require(total > 1, "too few voters");
        // the pubkey and address can not be reused
        voters[voter] = false;
        deletes[voter] = true;
        total--;
        emit RemovedVoter(voter);
    }
}
