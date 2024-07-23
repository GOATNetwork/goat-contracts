// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PreDeployedAddresses} from "../library/constants/Address.sol";
import {BaseAccess} from "../goat/BaseAccess.sol";

contract MuSiger is BaseAccess {
    event PubkeyChanged(bytes32[2]);

    enum MemberStatus {
        Operating,
        Removed
    }

    struct Member {
        address owner; // owner on the evm layer
        bytes32[2] pubkey; // pubkey on the pos layer
        MemberStatus status;
    }

    // event NewMember(uint256 id, bytes32[2] pubkey);

    Member[] public members;

    bytes32[2] internal pubkey;

    constructor(bytes32[2] memory _pubkey) {
        // It's only for testing
        // the contract should be included in genesis state
        // and the pubkey slot should be initialized as well

        pubkey = _pubkey;
    }

    function setPubkey(bytes32[2] calldata _pubkey) external OnlyPosOwner {
        pubkey = _pubkey;
        emit PubkeyChanged(_pubkey);
    }

    function getLatestPubkey(
        bool _compressed
    ) public view returns (bytes memory) {
        if (!_compressed) {
            return bytes.concat(bytes1(0x04), pubkey[0], pubkey[1]);
        }
        bool yIsEven = uint8(pubkey[1][0]) % 2 == 0;
        if (yIsEven) {
            return bytes.concat(bytes1(0x02), pubkey[0]);
        }
        return bytes.concat(bytes1(0x03), pubkey[0]);
    }

    function addMember(
        address _owner,
        bytes32[2] calldata _pubkey
    ) external OnlyDAOExecutor {
        // todo: implement it
    }
}
