// SPDX-License-Identifier: Apache 2.0
pragma solidity =0.8.28;

/**
 * Rotator lets a validator owner announce a new consensus public key.
 *
 * It is deliberately not part of Locking. Locking is a genesis predeploy with
 * no proxy in front of it, so on a live network its code can only change by
 * being rewritten at a coordinated fork, and the execution layer has no
 * mechanism for that. Nothing here needs Locking's storage: owners is public,
 * so the authorisation check reads it through the generated getter and this
 * contract deploys like any other.
 *
 * The consensus layer only honours Rotate logs from this address, which is why
 * the authorisation lives here rather than being left to the proof alone: the
 * proof shows possession of the new key, but anyone can generate a key and
 * sign a proof naming someone else's validator.
 */
interface ILockingOwners {
    function owners(address validator) external view returns (address);
}

contract Rotator {
    ILockingOwners public constant LOCKING =
        ILockingOwners(0xbC10000000000000000000000000000000000004);

    error NotValidatorOwner(address expected);
    error InvalidPubkey();
    error InvalidProof();

    /**
     * Rotate announces a new consensus public key for a validator.
     *
     * No parameter is indexed: the consensus layer skips any log from this
     * contract that does not carry exactly one topic.
     */
    event Rotate(address validator, uint8 keyType, bytes pubkey, bytes proof);

    /**
     * rotate replaces the validator consensus public key
     * @param validator the validator address, which does not change
     * @param keyType the consensus key type, 0 for secp256k1
     * @param pubkey the new consensus public key
     * @param proof possession of the new key, signed by the new key itself
     *
     * Note for operators:
     *
     * The validator address stays what it was at creation. It is a stable
     * identifier, not a hash of whatever key is in use, so owners, locking and
     * approvals all keep working across a rotation.
     *
     * The proof cannot be checked here. Locking.create can use ECDSA.recover
     * because the key it registers is secp256k1; there is no precompile for
     * the post quantum schemes this exists for, so the consensus layer
     * verifies it and ignores the rotation if it does not hold. Watch for the
     * validator_rotated event on the consensus layer to know it was accepted.
     */
    function rotate(
        address validator,
        uint8 keyType,
        bytes calldata pubkey,
        bytes calldata proof
    ) external {
        // an unknown validator has the zero owner, which no sender can be
        address owner = LOCKING.owners(validator);
        require(owner == msg.sender, NotValidatorOwner(owner));
        require(pubkey.length > 0, InvalidPubkey());
        require(proof.length > 0, InvalidProof());
        emit Rotate(validator, keyType, pubkey, proof);
    }
}
