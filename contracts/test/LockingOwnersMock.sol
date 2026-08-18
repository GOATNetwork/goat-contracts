// SPDX-License-Identifier: Apache 2.0
pragma solidity =0.8.28;

// Stands in for the Locking predeploy in Rotator's tests, which only needs the
// generated owners getter.
contract LockingOwnersMock {
    mapping(address validator => address owner) public owners;

    function setOwner(address validator, address owner) external {
        owners[validator] = owner;
    }
}
